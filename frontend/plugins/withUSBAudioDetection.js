/**
 * Expo Config Plugin for USB Audio Detection
 * Enables USB audio interface detection on iOS
 * Required for SPYN Record feature to detect external mixers
 */

const { withInfoPlist } = require('@expo/config-plugins');

const withUSBAudioDetection = (config) => {
  return withInfoPlist(config, (config) => {
    // Add USB audio related keys to Info.plist
    
    // Allow external accessory communication (for USB audio interfaces)
    if (!config.modResults.UISupportedExternalAccessoryProtocols) {
      config.modResults.UISupportedExternalAccessoryProtocols = [];
    }
    
    // Add audio-related protocols
    const audioProtocols = [
      'com.apple.m4a-audio',
      'com.apple.coreaudio',
    ];
    
    audioProtocols.forEach(protocol => {
      if (!config.modResults.UISupportedExternalAccessoryProtocols.includes(protocol)) {
        config.modResults.UISupportedExternalAccessoryProtocols.push(protocol);
      }
    });
    
    // Enable audio in background modes (should already be there but ensure it)
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    
    if (!config.modResults.UIBackgroundModes.includes('audio')) {
      config.modResults.UIBackgroundModes.push('audio');
    }
    
    // Add audio session category hint for external devices
    config.modResults.AVAudioSessionCategoryOptions = [
      'AVAudioSessionCategoryOptionAllowBluetooth',
      'AVAudioSessionCategoryOptionAllowBluetoothA2DP',
      'AVAudioSessionCategoryOptionDefaultToSpeaker',
    ];
    
    return config;
  });
};

module.exports = withUSBAudioDetection;
