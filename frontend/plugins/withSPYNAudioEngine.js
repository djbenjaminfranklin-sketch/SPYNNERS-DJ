const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add SPYNAudioEngine native module
 * Copies source files and adds them to Xcode project
 */
const withSPYNAudioEngine = (config) => {
  
  // First, copy the native files
  config = withDangerousMod(config, ['ios', async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(config.modRequest.platformProjectRoot, 'SPYNNERSDJ');
    const sourceDir = path.join(projectRoot, 'native-modules', 'ios');
    
    const filesToCopy = ['SPYNAudioEngine.swift', 'SPYNAudioEngine.m'];
    
    for (const fileName of filesToCopy) {
      const sourcePath = path.join(sourceDir, fileName);
      const destPath = path.join(iosPath, fileName);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`[SPYNAudioEngine] Copied ${fileName} to ios/SPYNNERSDJ/`);
      } else {
        console.warn(`[SPYNAudioEngine] Source file not found: ${sourcePath}`);
      }
    }
    
    // Update bridging header
    const bridgingHeaderPath = path.join(iosPath, 'SPYNNERSDJ-Bridging-Header.h');
    const bridgingContent = `//
//  SPYNNERSDJ-Bridging-Header.h
//

#ifndef SPYNNERSDJ_Bridging_Header_h
#define SPYNNERSDJ_Bridging_Header_h

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTViewManager.h>

#endif
`;
    fs.writeFileSync(bridgingHeaderPath, bridgingContent);
    console.log('[SPYNAudioEngine] Updated bridging header');
    
    return config;
  }]);
  
  // Then add to Xcode project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const targetUuid = xcodeProject.getFirstTarget().uuid;
    
    const filesToAdd = [
      { name: 'SPYNAudioEngine.swift', path: 'SPYNNERSDJ/SPYNAudioEngine.swift' },
      { name: 'SPYNAudioEngine.m', path: 'SPYNNERSDJ/SPYNAudioEngine.m' },
    ];
    
    for (const file of filesToAdd) {
      // Check if already added
      let alreadyAdded = false;
      for (const key in xcodeProject.hash.project.objects.PBXFileReference || {}) {
        const ref = xcodeProject.hash.project.objects.PBXFileReference[key];
        if (ref && (ref.name === file.name || ref.path === file.name)) {
          alreadyAdded = true;
          break;
        }
      }
      
      if (!alreadyAdded) {
        try {
          xcodeProject.addSourceFile(file.path, { target: targetUuid });
          console.log(`[SPYNAudioEngine] Added ${file.name} to Xcode project`);
        } catch (e) {
          console.log(`[SPYNAudioEngine] Note: ${file.name} may already exist in project`);
        }
      } else {
        console.log(`[SPYNAudioEngine] ${file.name} already in project`);
      }
    }
    
    return config;
  });
  
  return config;
};

module.exports = withSPYNAudioEngine;
