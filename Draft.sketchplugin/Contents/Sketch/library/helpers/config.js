// config.js

DraftApp.extend({
  getConfigs: function(container){
    logger.info('config.getConfigs()');
    var container = container || this.symbolsPage,
    command = this.command,
    prefix = this.prefix,
    configsData = command.valueForKey_onLayer(prefix, container);
    return JSON.parse(configsData);
  },
  setConfigs: function(newConfigs, container){
    logger.info('config.setConfigs()');
    var container = container || this.symbolsPage,
    command = this.command,
    prefix = this.prefix,
    configs = this.extend(newConfigs, this.getConfigs(container) || {});

    configs.timestamp = new Date().getTime();
    var configsData = JSON.stringify(configs);
    command.setValue_forKey_onLayer(configsData, prefix, container);
    return configs;
  },
  removeConfigs: function(container){
    logger.info('config.removeConfigs()');
    var container = container || this.symbolsPage,
    command = this.command,
    prefix = this.prefix;
    command.setValue_forKey_onLayer(null, prefix, container)
  },
  saveAccessToken: function (accessToken) {
    logger.info('config.saveAccessToken()');
    [[NSUserDefaults standardUserDefaults] setObject:accessToken forKey:"token"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  },
  readAccessToken: function () {
    logger.info("config.readAccessToken()");
    var accessToken = [[NSUserDefaults standardUserDefaults] objectForKey:"token"];
    return accessToken;
  },
  resetAccessToken: function () {
    logger.info("config.resetAccessToken()");
    var accessToken = nil;
    [[NSUserDefaults standardUserDefaults] setObject:accessToken forKey:"token"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  }
});
