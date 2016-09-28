/* Documentation
   Api GET and POST has 3 possible return values
   1. { body: .., statusCode: 2.. } -> Success
   2. { body: .., statusCode: 4.. } -> Error
   3. false -> Token invalid, need to login again
*/

var api = new Api();

function Api () {}

Api.prototype.validateToken = function() {
  if (DraftApp.isAuthHeaderExist()) {
    logger.info("Validating tokens..");
    var response = this.request("GET", "/auth/validate_token", {});

    logger.debug("Token validation response: " + JSON.stringify(response));
    if (response) {
      return true;
    } else {
      logger.info("Token validation failed, need to login");
      return false;
    }
  } else {
    return false;
  }
};

Api.prototype.post = function(path, params) {
  logger.info("api.post()");

  if (!this.validateToken()) return false;

  return this.request("POST", path, params);
};

Api.prototype.get = function(path, params) {
  logger.info("api.get()");

  if (!this.validateToken()) return false;

  return this.request("GET", path, params);
};

Api.prototype.request = function(method, path, params) {
  logger.info("api.request()" + " type: " + method + " to path: " + path);

  var url = DraftApp.apiURL + path;
  logger.debug("Requesting: " + url);

  var req = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
  [req setHTTPMethod:method];

  // Request Headers
  [req setValue:"Sketch" forHTTPHeaderField:"User-Agent"];
  // [req setValue:DraftApp.sketchVersion forHTTPHeaderField:"X-Sketch-Version"];
  // [req setValue:DraftApp.version forHTTPHeaderField:"X-Sketch-Plugin-Version"];
  [req setValue:"application/json" forHTTPHeaderField:"Content-Type"];

  // if (DraftApp.isAuthHeaderExist()) {
    var authHeaders = DraftApp.readAuthHeaders();
    var token = authHeaders.accessToken;
    var client = authHeaders.client;
    var expiry = authHeaders.expiry;
    var uid = authHeaders.uid;

    logger.info("api.request() accessToken: " + token);

    logger.info("Setting request auth headers");
    [req setValue:token forHTTPHeaderField:"access-token"];
    [req setValue:"Bearer" forHTTPHeaderField:"token-type"];
    [req setValue:client forHTTPHeaderField:"client"];
    [req setValue:expiry forHTTPHeaderField:"expiry"];
    [req setValue:uid forHTTPHeaderField:"uid"];
  // }

  if (params && method == "POST") {
    logger.debug("params: " + JSON.stringify(params));
    jsonParams = [NSJSONSerialization dataWithJSONObject:params options:NSJSONWritingPrettyPrinted error:nil];
    req.HTTPBody = jsonParams;
  }

  var response = MOPointer.alloc().init(),
    error = MOPointer.alloc().init(),
    res = NSURLConnection.sendSynchronousRequest_returningResponse_error(req, response, error);

  logger.debug("res: " + res);

  // FIXME: Res is null when 401, this needs checking,
  // as it causes the following block not to be executed
  if (error.value() && api.is401(error) && res) {
    var dataString = NSString.alloc().initWithData_encoding(res, NSUTF8StringEncoding);
    logger.error(dataString);

    var json = JSON.parse(dataString);
    // if(path != 'auth/sign_in') {
    //   // utils.dealWithNetErrors(context,res);
    //   // DraftApp.resetAccessToken();
    //   logger.debug("This is responsible");
    //   return false;
    // }
    return json;
  }

  // Handle other status codes
  if (!error.value() && res) {
    var statusCode = [[response value] statusCode];
    logger.info("Response code: " + statusCode);

    if (statusCode != 200 && res) {
      // this.dealWithNetErrors(res); //Alert Error if status code is not 200
      if (statusCode == 400 || statusCode == 440) {
        logger.debug("Status code is 400 || 440");
        // DraftApp.resetAccessToken(); // No need to reset
        // TODO: Return status code, so the app can report that back
        // DraftApp.loginPanel();
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

    if (authHeaders.accessToken)
      DraftApp.saveAuthHeaders(authHeaders);

    return { body: JSON.parse(dataString), statusCode: statusCode };

  } else {
    logger.error("error");
    return false;
  }
};

// Workaround for 401 error: http://goo.gl/GE3LNm
Api.prototype.is401 = function( error ) {
  logger.info("api.is401()");

  if (error == nil) return false;

  var errorString = [[error value] description];
  var strError = [NSString stringWithFormat:@"%@", [[error value] description]];

  if ([strError rangeOfString:@"Code=-1012"].location != NSNotFound) {
    logger.error("401 : Unauthorization - True");
    return true;
  } else {
    return false;
  }
};

// Api.prototype.dealWithNetErrors = function(errorData) {
//   logger.info("utils.dealWithNetErrors()");
//   logger.error(errorData);
//
//   var alert = [[NSAlert alloc] init];
//   var title = "Something went wrong...";
//   var message = "Please ensure your internet isn\'t down or a firewall is not blocking any connections to Atomic.io.";
//   var currentTime = new Date();
//
//   if (this.startingTime && (currentTime - this.startingTime > 60000 )){
//     title = "Your export failed as it was taking too long";
//     message = "You may be on a very slow connection or that export was huuuuge. Either way, the export failed, sorry.";
//     this.isSlowConnection = true;
//     this.startingTime = null;
//   } else if(errorData) {
//     var error = [[NSString alloc] initWithData:errorData encoding:NSUTF8StringEncoding];
//     logger.error("Received an error from the server");
//     try {
//       errorJson = JSON.parse(error);
//       title = errorJson.error;
//       message = errorJson.message;
//     } catch(e) {
//       logger.error(e)
//     }
//   }
//   [alert setMessageText:title];
//   [alert setInformativeText:message];
//   [alert addButtonWithTitle:'Close'];
//   return responseCode = [alert runModal];
// };

// =========================================================

// Api.prototype.upload = function(context, urls, exportData) {
//   logger.info("api.upload()");
//
//   if (!urls && !exportData) return false;
//
//   var bundlePath = exportData[0],
//   schemaPath = exportData[1];
//
//   return (api.uploadWithFilePath(context, urls.signedZippedUploadUrl, bundlePath)) &&
//     (api.uploadWithFilePath(context, urls.signedSchemaUploadUrl, schemaPath));
// };
//
// Api.prototype.uploadWithFilePath = function(context, url, filePath) {
//   logger.info("api.uploadWithFilePath() : "+ filePath);
//
//   var error = MOPointer.alloc().initWithValue(nil);
//   var fileData = [NSData dataWithContentsOfFile:filePath options:8 error:error];
//   // utils.uploadBundleSize = [fileData length];
//
//   if(!fileData) {
//     logger.error("failed to read data: " + error.value());
//     return;
//   }
//
//   var request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
//   [request setHTTPMethod:"PUT"];
//
//   var body = [NSMutableData data];
//   [body appendData:fileData];
//   [request setHTTPBody:body];
//
//   var response = MOPointer.alloc().init();
//   var error = MOPointer.alloc().init();
//   var res = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, response, error);
//   var dataString = NSString.alloc().initWithData_encoding(res, NSUTF8StringEncoding);
//
//   logger.debug(dataString)
//
//   if (error.value() == nil && res != nil) {
//     var statusCode = [[response value] statusCode];
//     return statusCode == 200;
//   } else {
//     // utils.dealWithNetErrors(context,res);
//     return false;
//   }
//
// };
