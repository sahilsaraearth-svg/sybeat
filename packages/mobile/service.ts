import TrackPlayer from "react-native-track-player";

// This service runs in background and handles remote control events
// Required by react-native-track-player
module.exports = async function () {
  // Events are handled in player.ts via addEventListener
  // This file just needs to exist and be registered
};
