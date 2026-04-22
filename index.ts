import YaleSyncPlatform from './src/YaleSyncPlatform';

export = ((api: any) => {
  api.registerPlatform('YaleSyncAlarm', YaleSyncPlatform);
});
