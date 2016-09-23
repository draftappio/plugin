var api = new Api();

function Api () {}

Api.prototype.post = function(path, params) {
  logger.info("api.post()");
  return this.request("POST", path, params);
};

Api.prototype.get = function(path, params) {
  logger.info("api.get()");
  return this.request("GET", path, params);
};

Api.prototype.upload = function(context, urls, exportData) {
  logger.info("api.upload()");

  if (!urls && !exportData) return false;

  var bundlePath = exportData[0],
  schemaPath = exportData[1];

  return (api.uploadWithFilePath(context, urls.signedZippedUploadUrl, bundlePath)) &&
    (api.uploadWithFilePath(context, urls.signedSchemaUploadUrl, schemaPath));
};

Api.prototype.request = function(method, path, params) {
  logger.info("api.request()" + " type: " + method + " to path: " + path);

  var url = DraftApp.apiURL + path;
  logger.debug("Requesting: " + url);

  var req = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
  [req setHTTPMethod:method];
  [req setValue:"Sketch" forHTTPHeaderField:"User-Agent"];

  // Request Headers
  // [req setValue:utils.sketchVersion forHTTPHeaderField:"X-Sketch-Version"];
  // [req setValue:utils.version forHTTPHeaderField:"X-Sketch-Plugin-Version"];
  [req setValue:"application/json" forHTTPHeaderField:"Content-Type"];

  var authHeaders = DraftApp.readAuthHeaders();
  if (authHeaders) {
    var token = authHeaders.accessToken;
    var client = authHeaders.client;
    var expiry = authHeaders.expiry;
    var uid = authHeaders.uid;

    logger.debug("Token found");
    logger.debug("Token: " + token);
    logger.debug("client: " + client);
    logger.debug("expiry: " + expiry);
    logger.debug("uid: " + uid);

    [req setValue:token forHTTPHeaderField:"access-token"];
    [req setValue:"Bearer" forHTTPHeaderField:"token-type"];
    [req setValue:client forHTTPHeaderField:"client"];
    [req setValue:expiry forHTTPHeaderField:"expiry"];
    [req setValue:uid forHTTPHeaderField:"uid"];
  }

  if (params) {
    logger.debug("params: " + params);
    jsonParams = [NSJSONSerialization dataWithJSONObject:params options:NSJSONWritingPrettyPrinted error:nil];
    req.HTTPBody = jsonParams;
  }

  var response = MOPointer.alloc().init(),
    error = MOPointer.alloc().init(),
    res = NSURLConnection.sendSynchronousRequest_returningResponse_error(req, response, error);

  // Handle 401 - workaround
  if (error.value() != nil && api.is401(error) && res != nil){
    var dataString = NSString.alloc().initWithData_encoding(res, NSUTF8StringEncoding);
    logger.error(dataString);
    var json = JSON.parse(dataString);
    if(path != 'auth/sign_in') {
      // utils.dealWithNetErrors(context,res);
      DraftApp.resetAccessToken();
      // TODO: if (!path.match(/^upload-url/)){
      DraftApp.loginPanel();
      // }
      // return false;
    }
    return json;
  }

  // Handle other status codes
  if (error.value() == nil && res != nil) {
    var statusCode = [[response value] statusCode];
    logger.info("Response code: " + statusCode);

    if (statusCode != 200 && res) {
      // utils.dealWithNetErrors(context, res); //Alert Error if status code is not 200
      if (statusCode == 400 || statusCode == 440) {
        DraftApp.resetAccessToken();
        DraftApp.loginPanel();
      }
    }

    var dataString = NSString.alloc().initWithData_encoding(res, NSUTF8StringEncoding);
    // Parse auth headers and save them
    logger.debug("Response data: " + dataString);

    var headerFields = [[response value] allHeaderFields];

    var authHeaders = {};
    authHeaders.accessToken = headerFields["access-token"];
    authHeaders.client = headerFields["client"];
    authHeaders.expiry = headerFields["expiry"];
    authHeaders.uid = headerFields["uid"];

    DraftApp.saveAuthHeaders(authHeaders);

    return JSON.parse(dataString);

  } else {
    logger.error("error");
    // utils.dealWithNetErrors(context);
    return false;
  }
};

// Workaround for 401 error: http://goo.gl/GE3LNm
Api.prototype.is401 = function( error ){
  logger.info("api.is401()");
  if (error == nil) return false;
  var errorString = [[error value] description];
  var strError = [NSString stringWithFormat:@"%@", [[error value] description]];
  if ([strError rangeOfString:@"Code=-1012"].location != NSNotFound) {
    logger.error("401 : Unauthorization");
    return true;
  } else {
    return false;
  }
};

Api.prototype.uploadWithFilePath = function(context, url, filePath) {
  logger.info("api.uploadWithFilePath() : "+ filePath);

  var error = MOPointer.alloc().initWithValue(nil);
  var fileData = [NSData dataWithContentsOfFile:filePath options:8 error:error];
  // utils.uploadBundleSize = [fileData length];

  if(!fileData) {
    logger.error("failed to read data: " + error.value());
    return;
  }

  var request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
  [request setHTTPMethod:"PUT"];

  var body = [NSMutableData data];
  [body appendData:fileData];
  [request setHTTPBody:body];

  var response = MOPointer.alloc().init();
  var error = MOPointer.alloc().init();
  var res = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, response, error);
  var dataString = NSString.alloc().initWithData_encoding(res, NSUTF8StringEncoding);

  logger.debug(dataString)

  if (error.value() == nil && res != nil) {
    var statusCode = [[response value] statusCode];
    return statusCode == 200;
  } else {
    // utils.dealWithNetErrors(context,res);
    return false;
  }

};
