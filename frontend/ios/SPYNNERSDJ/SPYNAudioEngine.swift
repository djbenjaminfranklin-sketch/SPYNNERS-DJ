//
//  SPYNAudioEngine.swift
//  SPYNNERSDJ
//
//  Professional audio engine for real-time VU meters and waveform visualization
//

import Foundation
import AVFoundation
import Accelerate

@objc(SPYNAudioEngine)
class SPYNAudioEngine: RCTEventEmitter {
  
  private var audioEngine: AVAudioEngine?
  private var inputNode: AVAudioInputNode?
  private var isRunning = false
  
  private var leftLevel: Float = -160.0
  private var rightLevel: Float = -160.0
  private var peakLeftLevel: Float = -160.0
  private var peakRightLevel: Float = -160.0
  private var waveformData: [Float] = []
  
  private let peakDecayRate: Float = 0.95
  private let levelSmoothingFactor: Float = 0.3
  private let waveformSampleCount = 128
  
  private var displayLink: CADisplayLink?
  
  override init() {
    super.init()
    setupNotifications()
  }
  
  deinit {
    stopEngine()
    NotificationCenter.default.removeObserver(self)
  }
  
  override func supportedEvents() -> [String]! {
    return ["onAudioData", "onAudioRouteChange", "onAudioError"]
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  private func setupNotifications() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
  }
  
  @objc private func handleRouteChange(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }
    
    let session = AVAudioSession.sharedInstance()
    let currentRoute = session.currentRoute
    
    var inputName = "Microphone interne"
    var isExternal = false
    
    for input in currentRoute.inputs {
      let portType = input.portType
      inputName = input.portName
      
      if portType == .usbAudio || portType == .bluetoothA2DP || 
         portType == .bluetoothHFP || portType == .headsetMic ||
         portType == .lineIn || portType == .headphones {
        isExternal = true
        break
      }
    }
    
    sendEvent(withName: "onAudioRouteChange", body: [
      "reason": reason.rawValue,
      "inputName": inputName,
      "isExternal": isExternal,
      "inputCount": currentRoute.inputs.count
    ])
    
    if isRunning {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        self?.restartEngine()
      }
    }
  }
  
  @objc(startEngine:rejecter:)
  func startEngine(_ resolve: @escaping RCTPromiseResolveBlock, 
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
        try session.setActive(true)
        
        self.audioEngine = AVAudioEngine()
        guard let engine = self.audioEngine else {
          reject("ENGINE_ERROR", "Could not create audio engine", nil)
          return
        }
        
        self.inputNode = engine.inputNode
        guard let inputNode = self.inputNode else {
          reject("INPUT_ERROR", "Could not get input node", nil)
          return
        }
        
        let format = inputNode.outputFormat(forBus: 0)
        let sampleRate = format.sampleRate
        let channelCount = format.channelCount
        
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, time in
          self?.processAudioBuffer(buffer)
        }
        
        try engine.start()
        self.isRunning = true
        self.startDisplayLink()
        
        let currentRoute = session.currentRoute
        var inputName = "Microphone interne"
        var isExternal = false
        
        for input in currentRoute.inputs {
          inputName = input.portName
          let portType = input.portType
          if portType == .usbAudio || portType == .bluetoothA2DP || 
             portType == .bluetoothHFP || portType == .headsetMic ||
             portType == .lineIn {
            isExternal = true
            break
          }
        }
        
        resolve([
          "success": true,
          "sampleRate": sampleRate,
          "channelCount": channelCount,
          "inputName": inputName,
          "isExternal": isExternal
        ])
        
      } catch {
        reject("START_ERROR", "Failed to start: \(error.localizedDescription)", error)
      }
    }
  }
  
  @objc(stopEngine:rejecter:)
  func stopEngine(_ resolve: @escaping RCTPromiseResolveBlock, 
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    stopEngine()
    resolve(["success": true])
  }
  
  private func stopEngine() {
    stopDisplayLink()
    if let inputNode = inputNode { inputNode.removeTap(onBus: 0) }
    audioEngine?.stop()
    audioEngine = nil
    inputNode = nil
    isRunning = false
    leftLevel = -160.0
    rightLevel = -160.0
    peakLeftLevel = -160.0
    peakRightLevel = -160.0
    waveformData = []
  }
  
  private func restartEngine() {
    let wasRunning = isRunning
    stopEngine()
    if wasRunning { startEngine({ _ in }, rejecter: { _, _, _ in }) }
  }
  
  private func startDisplayLink() {
    stopDisplayLink()
    displayLink = CADisplayLink(target: self, selector: #selector(sendAudioData))
    displayLink?.preferredFramesPerSecond = 60
    displayLink?.add(to: .main, forMode: .common)
  }
  
  private func stopDisplayLink() {
    displayLink?.invalidate()
    displayLink = nil
  }
  
  @objc private func sendAudioData() {
    guard isRunning else { return }
    peakLeftLevel = max(leftLevel, peakLeftLevel * peakDecayRate)
    peakRightLevel = max(rightLevel, peakRightLevel * peakDecayRate)
    
    sendEvent(withName: "onAudioData", body: [
      "leftLevel": leftLevel,
      "rightLevel": rightLevel,
      "peakLeft": peakLeftLevel,
      "peakRight": peakRightLevel,
      "waveform": waveformData,
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
  }
  
  private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
    guard let channelData = buffer.floatChannelData else { return }
    
    let channelCount = Int(buffer.format.channelCount)
    let frameLength = Int(buffer.frameLength)
    
    let leftChannel = channelData[0]
    var leftRMS: Float = 0
    vDSP_rmsqv(leftChannel, 1, &leftRMS, vDSP_Length(frameLength))
    
    var rightRMS: Float = 0
    if channelCount > 1 {
      let rightChannel = channelData[1]
      vDSP_rmsqv(rightChannel, 1, &rightRMS, vDSP_Length(frameLength))
    } else {
      rightRMS = leftRMS
    }
    
    let leftDB = 20 * log10(max(leftRMS, 0.000001))
    let rightDB = 20 * log10(max(rightRMS, 0.000001))
    
    leftLevel = leftLevel + levelSmoothingFactor * (leftDB - leftLevel)
    rightLevel = rightLevel + levelSmoothingFactor * (rightDB - rightLevel)
    leftLevel = max(-60, min(0, leftLevel))
    rightLevel = max(-60, min(0, rightLevel))
    
    extractWaveform(from: leftChannel, frameLength: frameLength)
  }
  
  private func extractWaveform(from channelData: UnsafeMutablePointer<Float>, frameLength: Int) {
    let stride = max(1, frameLength / waveformSampleCount)
    var samples: [Float] = []
    for i in 0..<waveformSampleCount {
      let index = i * stride
      if index < frameLength {
        let sample = (channelData[index] + 1.0) / 2.0
        samples.append(max(0, min(1, sample)))
      }
    }
    waveformData = samples
  }
  
  @objc(getAudioInputs:rejecter:)
  func getAudioInputs(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    let session = AVAudioSession.sharedInstance()
    var inputs: [[String: Any]] = []
    for input in session.currentRoute.inputs {
      inputs.append([
        "name": input.portName,
        "type": input.portType.rawValue,
        "uid": input.uid,
        "isExternal": input.portType == .usbAudio || input.portType == .bluetoothA2DP || input.portType == .lineIn
      ])
    }
    resolve(inputs)
  }
  
  @objc(checkUSBConnected:rejecter:)
  func checkUSBConnected(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    let session = AVAudioSession.sharedInstance()
    var isUSB = false
    var deviceName = "Microphone interne"
    for input in session.currentRoute.inputs {
      if input.portType == .usbAudio {
        isUSB = true
        deviceName = input.portName
        break
      }
    }
    resolve(["isUSBConnected": isUSB, "deviceName": deviceName])
  }
}
