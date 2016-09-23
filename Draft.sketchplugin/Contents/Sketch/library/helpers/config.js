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
  saveAuthHeaders: function (data) {
    logger.info('config.saveAuthHeaders()');

    var accessToken = data.accessToken;
    var client      = data.client;
    var expiry      = data.expiry;
    var uid         = data.uid;

    logger.debug("accessToken: " + accessToken);
    logger.debug("client: " + client);
    logger.debug("expiry: " + expiry);
    logger.debug("uid: " + uid);

    [[NSUserDefaults standardUserDefaults] setObject:accessToken forKey:"token"];
    [[NSUserDefaults standardUserDefaults] setObject:client forKey:"client"];
    [[NSUserDefaults standardUserDefaults] setObject:expiry forKey:"expiry"];
    [[NSUserDefaults standardUserDefaults] setObject:uid forKey:"uid"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  },
  readAuthHeaders: function () {
    logger.info("config.readAuthHeaders()");

    var data = {};

    data.accessToken = [[NSUserDefaults standardUserDefaults] objectForKey:"token"];
    data.client      = [[NSUserDefaults standardUserDefaults] objectForKey:"client"];
    data.expiry      = [[NSUserDefaults standardUserDefaults] objectForKey:"expiry"];
    data.uid         = [[NSUserDefaults standardUserDefaults] objectForKey:"uid"];

    return data;
  },
  isAuthHeaderExist: function () {
    if (!this.readAuthHeaders().accessToken) return false;

    return true;
  },
  resetAccessToken: function () {
    logger.info("config.resetAccessToken()");
    [[NSUserDefaults standardUserDefaults] setObject:nil forKey:"token"];
    [[NSUserDefaults standardUserDefaults] setObject:nil forKey:"client"];
    [[NSUserDefaults standardUserDefaults] setObject:nil forKey:"expiry"];
    [[NSUserDefaults standardUserDefaults] setObject:nil forKey:"uid"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  }
});
