import { Alert, BackHandler, Platform } from 'react-native';

export const androidAppExitService = {
  showConfirmation(confirm: () => void, cancel: () => void) {
    if (Platform.OS !== 'android') { cancel(); return; }
    Alert.alert('Exit RentLease?', 'Do you want to exit the app?', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Exit', onPress: confirm },
    ], { cancelable: true, onDismiss: cancel });
  },
  exit() { if (Platform.OS === 'android') BackHandler.exitApp(); },
};
