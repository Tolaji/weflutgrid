import { Platform } from 'react-native';

const MapComponent = Platform.select({
  web: () => require('./MapComponent.web').default,
  default: () => require('./MapComponent.native').default
})();
export default MapComponent;
