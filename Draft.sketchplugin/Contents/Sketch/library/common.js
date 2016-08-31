var I18N = {},
    webI18N = {
      "zh-Hans": "zh-cn",
      "zh-Hant": "zh-tw"
    },
    lang = NSUserDefaults.standardUserDefaults().objectForKey("AppleLanguages").objectAtIndex(0),
    language = "";

function _(str, data){
  var str = (I18N[lang] && I18N[lang][str])? I18N[lang][str]: str,
  idx = -1;
  return str.replace(/\%\@/gi, function(){
    idx++;
    return data[idx];
  });
}

var SM = {
  init: function(context, command){
    coscript.setShouldKeepAround(true);
    this.context = context;
    this.extend(context);
    this.document = context.document;
    this.documentData = this.document.documentData();
    this.window = this.document.window();
    this.pages = this.document.pages();
    this.page = this.document.currentPage();
    this.artboard = this.page.currentArtboard();
    this.current = this.artboard || this.page;
    this.pluginRoot = this.scriptPath
      .stringByDeletingLastPathComponent()
      .stringByDeletingLastPathComponent()
      .stringByDeletingLastPathComponent();
    this.pluginSketch = this.pluginRoot + "/Contents/Sketch/library";

    if(command == "toolbar"){
      this.ToolBar();
      return false;
    }

    if(NSFileManager.defaultManager().fileExistsAtPath(this.pluginSketch + "/i18n/" + lang + ".json")){
      language = NSString.stringWithContentsOfFile_encoding_error(this.pluginSketch + "/i18n/" + lang + ".json", NSUTF8StringEncoding, nil);

      I18N[lang] = JSON.parse(language);
      language = "I18N[\'" + webI18N[lang] + "\'] = " + language;
    }

    this.symbolsPage = this.find({key: "(name != NULL) && (name == %@)", match: "Symbols"}, this.document);
    this.symbolsPage = (this.symbolsPage.count)? this.symbolsPage[0]: this.symbolsPage;
    if(!this.symbolsPage){
      this.symbolsPage = this.document.addBlankPage();
      this.symbolsPage.setName("Symbols");
      this.document.setCurrentPage(this.page);
    }


    this.configs = this.getConfigs();

    if(!this.configs && command != "settings"){
      if(!this.settingsPanel()) return false;
    }

    if(!this.readAccessToken() && command != "login") this.loginPanel();

    switch (command) {
      case "mark-overlays":
        this.markOverlays();
        break;
      case "lite-sizes":
        this.liteSizes();
        break;
      case "lite-spacings":
        this.liteSpacings();
        break;
      case "lite-properties":
        this.liteProperties();
        break;
      case "mark-sizes":
        this.markSizes();
        break;
      case "mark-spacings":
        this.markSpacings();
        break;
      case "mark-properties":
        this.markProperties();
        break;
      case "mark-note":
        this.markNote();
        break;
      case "locked":
        this.toggleLocked();
        break;
      case "hidden":
        this.toggleHidden();
        break;
      case "clear":
        this.clearAllMarks();
        break;
      case "color":
        this.manageColors();
        break;
      case "exportable":
        this.makeExportable();
        break;
      case "settings":
        this.settingsPanel();
        break;
      case "login":
        if(!this.readAccessToken()) {
          this.loginPanel();
        } else {
          this.alreadyLoggedPanel();
        }
        break;
      case "logout":
        this.resetAccessToken();
        this.loggedoutPanel();
        break;
      case "export":
        this.export();
        break;
    }

  },
  extend: function( options, target ){
    var target = target || this;

    for ( var key in options ){
      target[key] = options[key];
    }
    return target;
  }
},
  BorderPositions = ["center", "inside", "outside"],
  FillTypes = ["color", "gradient"],
  GradientTypes = ["linear", "radial", "angular"],
  ShadowTypes = ["outer", "inner"],
  TextAligns = ["left", "right", "center", "justify", "left"],
  ResizingType = ["stretch", "corner", "resize", "float"];

SM.extend({
  prefix: "SMConfigs2",
  regexNames: /OVERLAY\#|WIDTH\#|HEIGHT\#|TOP\#|RIGHT\#|BOTTOM\#|LEFT\#|VERTICAL\#|HORIZONTAL\#|NOTE\#|PROPERTY\#|LITE\#/,
  colors: {
    overlay: {
      layer: { r: 1, g: 0.333333, b: 0, a: 0.3 },
      text: { r: 1, g: 1, b: 1, a: 1 }
    },
    size: {
      layer: { r: 1, g: 0.333333, b: 0, a: 1 },
      text: { r: 1, g: 1, b: 1, a: 1 }
    },
    spacing: {
      layer: { r: 0.313725, g: 0.890196, b: 0.760784, a: 1 },
      text: { r: 1, g: 1, b: 1, a: 1 }
    },
    property: {
      layer: { r: 0.960784, g: 0.650980, b: 0.137255, a: 1 },
      text: { r: 1, g: 1, b: 1, a: 1 }
    },
    lite: {
      layer: { r: 0.564706, g: 0.074510, b: 0.996078, a: 1 },
      text: { r: 1, g: 1, b: 1, a: 1 }
    },
    note: {
      layer: { r: 1, g: 0.988235, b: 0.862745, a: 1 },
      border: { r: 0.8, g: 0.8, b: 0.8, a: 1},
      text: { r: 0.333333, g: 0.333333, b: 0.333333, a: 1 }
    }
  }
});

// api.js
SM.extend({
  is: function(layer, theClass){
    if(!layer) return false;
    var klass = layer.class();
    return klass === theClass;
  },
  addGroup: function(){
    return MSLayerGroup.new();
  },
  addShape: function(){
    var shape = MSRectangleShape.alloc().initWithFrame(NSMakeRect(0, 0, 100, 100));
    return MSShapeGroup.shapeWithPath(shape);
  },
  addText: function(container){
    var text = MSTextLayer.new();
    text.setStringValue("text");
    return text;
  },
  removeLayer: function(layer){
    var container = layer.parentGroup();
    if (container) container.removeLayer(layer);
  },
  getRect: function(layer){
    var rect = layer.absoluteRect();
    return {
      x: Math.round(rect.x()),
      y: Math.round(rect.y()),
      width: Math.round(rect.width()),
      height: Math.round(rect.height()),
      maxX: Math.round(rect.x() + rect.width()),
      maxY: Math.round(rect.y() + rect.height()),
      setX: function(x){ rect.setX(x); this.x = x; this.maxX = this.x + this.width; },
      setY: function(y){ rect.setY(y); this.y = y; this.maxY = this.y + this.height; },
      setWidth: function(width){ rect.setWidth(width); this.width = width; this.maxX = this.x + this.width; },
      setHeight: function(height){ rect.setHeight(height); this.height = height; this.maxY = this.y + this.height; }
    };
  },
  toNopPath: function(str){
    return this.toJSString(str).replace(/[\/\\\?]/g, " ");
  },
  toHTMLEncode: function(str){
    return this.toJSString(str)
      .replace(/\&/g, "&amp;")
      .replace(/\</g, "&lt;")
      .replace(/\>/g, '&gt;')
      .replace(/\'/g, "&#39;")
      .replace(/\"/g, "&quot;")
      .replace(/\u2028/g,"\\u2028")
      .replace(/\u2029/g,"\\u2029")
      ;
    // return str.replace(/\&/g, "&amp;").replace(/\"/g, "&quot;").replace(/\'/g, "&#39;").replace(/\</g, "&lt;").replace(/\>/g, '&gt;');
  },
  toSlug: function(str){
    return this.toJSString(str)
      .toLowerCase()
      .replace(/(<([^>]+)>)/ig, "")
      .replace(/[\/\+\|]/g, " ")
      .replace(new RegExp("[\\!@#$%^&\\*\\(\\)\\?=\\{\\}\\[\\]\\\\\\\,\\.\\:\\;\\']", "gi"),'')
      .replace(/\s+/g,'-')
      ;
  },
  toJSString: function(str){
    return new String(str).toString();
  },
  toJSNumber: function(str){
    return Number( this.toJSString(str) );
  },
  pointToJSON: function(point){
    return {
      x: parseFloat(point.x),
      y: parseFloat(point.y)
    };
  },
  rectToJSON: function(rect, referenceRect) {
    if (referenceRect) {
      return {
        x: Math.round( rect.x() - referenceRect.x() ),
        y: Math.round( rect.y() - referenceRect.y() ),
        width: Math.round( rect.width() ),
        height: Math.round( rect.height() )
      };
    }

    return {
      x: Math.round( rect.x() ),
      y: Math.round( rect.y() ),
      width: Math.round( rect.width() ),
      height: Math.round( rect.height() )
    };
  },
  colorToJSON: function(color) {
    return {
      r: Math.round(color.red() * 255),
      g: Math.round(color.green() * 255),
      b: Math.round(color.blue() * 255),
      a: color.alpha(),
      "color-hex": color.immutableModelObject().stringValueWithAlpha(false) + " " + Math.round(color.alpha() * 100) + "%",
      "argb-hex": "#" + this.toHex(color.alpha() * 255) + color.hexValue(),
      "css-rgba": "rgba(" + [
        Math.round(color.red() * 255),
        Math.round(color.green() * 255),
        Math.round(color.blue() * 255),
        (Math.round(color.alpha() * 100) / 100)
      ].join(",") + ")",
      "ui-color": "(" + [
        "r:" + (Math.round(color.red() * 100) / 100).toFixed(2),
        "g:" + (Math.round(color.green() * 100) / 100).toFixed(2),
        "b:" + (Math.round(color.blue() * 100) / 100).toFixed(2),
        "a:" + (Math.round(color.alpha() * 100) / 100).toFixed(2)
      ].join(" ") + ")"
    };
  },
  colorStopToJSON: function(colorStop) {
    return {
      color: this.colorToJSON(colorStop.color()),
      position: colorStop.position()
    };
  },
  gradientToJSON: function(gradient) {
    var stopsData = [],
    stop, stopIter = gradient.stops().objectEnumerator();
    while (stop = stopIter.nextObject()) {
      stopsData.push(this.colorStopToJSON(stop));
    }

    return {
      type: GradientTypes[gradient.gradientType()],
      from: this.pointToJSON(gradient.from()),
      to: this.pointToJSON(gradient.to()),
      colorStops: stopsData
    };
  },
  shadowToJSON: function(shadow) {
    return {
      type: shadow instanceof MSStyleShadow ? "outer" : "inner",
      offsetX: shadow.offsetX(),
      offsetY: shadow.offsetY(),
      blurRadius: shadow.blurRadius(),
      spread: shadow.spread(),
      color: this.colorToJSON(shadow.color())
    };
  },
  getRadius: function(layer){
    return ( layer.layers && this.is(layer.layers().firstObject(), MSRectangleShape) ) ? layer.layers().firstObject().fixedRadius(): 0;
  },
  getBorders: function(style) {
    var bordersData = [],
    border, borderIter = style.borders().objectEnumerator();
    while (border = borderIter.nextObject()) {
      if (border.isEnabled()) {
        var fillType = FillTypes[border.fillType()],
          borderData = {
            fillType: fillType,
            position: BorderPositions[border.position()],
            thickness: border.thickness()
          };

        switch (fillType) {
          case "color":
            borderData.color = this.colorToJSON(border.color());
            break;

          case "gradient":
            borderData.gradient = this.gradientToJSON(border.gradient());
            break;

          default:
            continue;
        }

        bordersData.push(borderData);
      }
    }

    return bordersData;
  },
  getFills: function(style) {
    var fillsData = [],
    fill, fillIter = style.fills().objectEnumerator();
    while (fill = fillIter.nextObject()) {
      if (fill.isEnabled()) {
        var fillType = FillTypes[fill.fillType()],
          fillData = {
            fillType: fillType
          };

        switch (fillType) {
          case "color":
            fillData.color = this.colorToJSON(fill.color());
            break;

          case "gradient":
            fillData.gradient = this.gradientToJSON(fill.gradient());
            break;

          default:
            continue;
        }

        fillsData.push(fillData);
      }
    }

    return fillsData;
  },
  getShadows: function(style) {
    var shadowsData = [],
    shadow, shadowIter = style.shadows().objectEnumerator();
    while (shadow = shadowIter.nextObject()) {
      if (shadow.isEnabled()) {
        shadowsData.push(this.shadowToJSON(shadow));
      }
    }

    shadowIter = style.innerShadows().objectEnumerator();
    while (shadow = shadowIter.nextObject()) {
      if (shadow.isEnabled()) {
        shadowsData.push(this.shadowToJSON(shadow));
      }
    }

    return shadowsData;
  },
  getOpacity: function(style){
    return style.contextSettings().opacity()
  },
  getStyleName: function(layer){
    var styles = (this.is(layer, MSTextLayer))? this.document.documentData().layerTextStyles(): this.document.documentData().layerStyles(),
    layerStyle = layer.style(),
    sharedObjectID = layerStyle.sharedObjectID(),
    style;

    styles = styles.objectsSortedByName();

    if(styles.count() > 0){
      style = this.find({key: "(objectID != NULL) && (objectID == %@)", match: sharedObjectID}, styles);
    }

    if(!style) return "";
    return this.toJSString(style.name());
  },
  updateContext: function(){
    this.context.document = NSDocumentController.sharedDocumentController().currentDocument();
    this.context.selection = this.context.document.selectedLayers();

    return this.context;
  }
});

// help.js
SM.extend({
  mathHalf: function(number){
    return Math.round( number / 2 );
  },
  convertUnit: function(length, isText, percentageType){
    if(percentageType && this.artboard){
      var artboardRect = this.getRect( this.artboard );
      if (percentageType == "width") {
        return Math.round((length / artboardRect.width) * 1000) / 10 + "%";

      }
      else if(percentageType == "height"){
        return Math.round((length / artboardRect.height) * 1000) / 10 + "%";
      }
    }

    var length = Math.round( length / this.configs.scale * 10 ) / 10,
    units = this.configs.unit.split("/"),
    unit = units[0];

    if( units.length > 1 && isText){
      unit = units[1];
    }

    return length + unit;
  },
  toHex:function(c) {
    var hex = Math.round(c).toString(16).toUpperCase();
    return hex.length == 1 ? "0" + hex :hex;
  },
  isIntersect: function(targetRect, layerRect){
    return !(
        targetRect.maxX <= layerRect.x ||
        targetRect.x >= layerRect.maxX ||
        targetRect.y >= layerRect.maxY ||
        targetRect.maxY <= layerRect.y
        );
  },
  getDistance: function(targetRect, containerRect){
    var containerRect = containerRect || this.getRect(this.current);

    return {
      top: (targetRect.y - containerRect.y),
      right: (containerRect.maxX - targetRect.maxX),
      bottom: (containerRect.maxY - targetRect.maxY),
      left: (targetRect.x - containerRect.x),
    }
  },
  message: function(message){
    this.document.showMessage(message);
  },
  find: function(format, container, returnArray){
    if(!format || !format.key  || !format.match){
      return false;
    }
    var predicate = NSPredicate.predicateWithFormat(format.key,format.match),
    container = container || this.current,
    items;

    if( (container.class && container.class() == __NSArrayI) ){
      items = container;
    }
    else if(container.pages){
      items = container.pages();
    }
    else if( this.is( container, MSSharedStyleContainer ) || this.is( container, MSSharedTextStyleContainer ) ){
      items = container.objectsSortedByName();
    }
    else{
      items = container.children();
    }

    var queryResult = items.filteredArrayUsingPredicate(predicate);

    if(returnArray) return queryResult;

    if (queryResult.count() == 1){
      return queryResult[0];
    } else if (queryResult.count() > 0){
      return queryResult;
    } else {
      return false;
    }
  },
  clearAllMarks: function(){
    var layers = this.page.children().objectEnumerator();
    while(layer = layers.nextObject()) {
      if(this.is(layer, MSLayerGroup) && this.regexNames.exec(layer.name())){
        this.removeLayer(layer)
      }
    }
  },
  toggleHidden: function(){
    var isHidden = (this.configs.isHidden)? false : !Boolean(this.configs.isHidden);
    this.configs = this.setConfigs({isHidden: isHidden});

    var layers = this.page.children().objectEnumerator();

    while(layer = layers.nextObject()) {
      if(this.is(layer, MSLayerGroup) && this.regexNames.exec(layer.name())){
        layer.setIsVisible(!isHidden);
      }
    }
  },
  toggleLocked: function(){
    var isLocked = (this.configs.isLocked)? false : !Boolean(this.configs.isLocked);
    this.configs = this.setConfigs({isLocked: isLocked});

    var layers = this.page.children().objectEnumerator();

    while(layer = layers.nextObject()) {
      if(this.is(layer, MSLayerGroup) && this.regexNames.exec(layer.name())){
        layer.setIsLocked(isLocked);
      }
    }
  },
});

// configs.js
SM.extend({
  getConfigs: function(container){
    var container = container || this.symbolsPage,
    command = this.command,
    prefix = this.prefix,
    configsData = command.valueForKey_onLayer(prefix, container);
    return JSON.parse(configsData);
  },
  setConfigs: function(newConfigs, container){
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
    var container = container || this.symbolsPage,
    command = this.command,
    prefix = this.prefix;
    command.setValue_forKey_onLayer(null, prefix, container)
  },
  saveAccessToken: function (accessToken) {
    log('saveAccessToken()');
    [[NSUserDefaults standardUserDefaults] setObject:accessToken forKey:"token"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  },
  readAccessToken: function () {
    log("readAccessToken()");
    var accessToken = [[NSUserDefaults standardUserDefaults] objectForKey:"token"];
    return accessToken;
  },
  resetAccessToken: function () {
    log("resetAccessToken()");
    var accessToken = nil;
    [[NSUserDefaults standardUserDefaults] setObject:accessToken forKey:"token"];
    [[NSUserDefaults standardUserDefaults] synchronize];
  }
});

//shared.js
SM.extend({
  sharedLayerStyle: function(name, color, borderColor) {
    var sharedStyles = this.documentData.layerStyles(),
    style = this.find({key: "(name != NULL) && (name == %@)", match: name}, sharedStyles);

    style = ( !style || this.is(style, MSSharedStyle))? style: style[0];

    if( style == false ){
      style = MSStyle.alloc().init();

      var color = MSColor.colorWithRed_green_blue_alpha(color.r, color.g, color.b, color.a),
      fill = style.addStylePartOfType(0);

      fill.color = color;

      if(borderColor){
        var border = style.addStylePartOfType(1),
          borderColor = MSColor.colorWithRed_green_blue_alpha(borderColor.r, borderColor.g, borderColor.b, borderColor.a);

        border.color = borderColor;
        border.thickness = 1;
        border.position = 1;
      }

      sharedStyles.addSharedStyleWithName_firstInstance(name, style);
    }

    return (style.newInstance)? style.newInstance(): style;
  },
  sharedTextStyle: function(name, color, alignment){
    var sharedStyles = this.document.documentData().layerTextStyles(),
    style = this.find({key: "(name != NULL) && (name == %@)", match: name}, sharedStyles);

    style = (!style || this.is(style, MSSharedStyle))? style: style[0];

    if( style == false ){
      var color = MSColor.colorWithRed_green_blue_alpha(color.r, color.g, color.b, color.a),
        alignment = alignment || 0, //[left, right, center, justify]
        text = this.addText(this.page);

      text.setTextColor(color);

      text.setFontSize(12);
      text.setFontPostscriptName("HelveticaNeue");
      text.setTextAlignment(alignment);

      style = text.style();
      sharedStyles.addSharedStyleWithName_firstInstance(name, style);
      this.removeLayer(text);
    }

    return (style.newInstance)? style.newInstance(): style;
  }
});

// ruler.js
SM.extend({
  setRuler: function( options ){
    var options = this.extend(options, {
      container: this.current,
      target: this.current,
      type: "width",
      placement: "center",
    }),
    container = options.container,
    type = options.type,
    styles = options.styles,
    target = options.target,
    placement = options.placement,
    shapeTemp = this.addShape();

    if(styles){
      shapeTemp.setStyle(styles.layer);
    }
    else{
      shapeTemp.style().addStylePartOfType(0);
    }

    var start = shapeTemp.duplicate(),
    end = shapeTemp.duplicate(),
    line = shapeTemp.duplicate(),
    targetRect = this.getRect(target),
    startRect = this.getRect(start),
    endRect = this.getRect(end),
    lineRect = this.getRect(line);

    container.addLayers([start, end, line]);

    start.setName("ruler-start");
    end.setName("ruler-end");
    line.setName("ruler-line");

    // height
    if(type == "height"){
      // set sizes
      lineRect.setWidth(1);
      lineRect.setHeight(targetRect.height);
      startRect.setWidth(5);
      startRect.setHeight(1);
      endRect.setWidth(5);
      endRect.setHeight(1);

      // get positions
      var x = targetRect.x + this.mathHalf(targetRect.width) - 1,
      y = targetRect.y;

      if(!this.is(target, MSPage) && !this.is(target, MSArtboardGroup)){
        switch(placement){
          case "left":
            x = targetRect.x - 4;
            break;
          case "right":
            x = targetRect.maxX + 3;
            break;
        }
      }

      var startX = x - 2,
      startY = y,
      endX = startX,
      endY = targetRect.maxY - 1;
    }
    else{
      // set sizes
      lineRect.setWidth(targetRect.width);
      lineRect.setHeight(1);
      startRect.setWidth(1);
      startRect.setHeight(5);
      endRect.setWidth(1);
      endRect.setHeight(5);

      // get positions
      var x = targetRect.x,
      y = targetRect.y + this.mathHalf(targetRect.height) - 1;

      if(!this.is(target, MSPage) && !this.is(target, MSArtboardGroup)){
        switch(placement){
          case "top":
            y = targetRect.y - 4;
            break;
          case "bottom":
            y = targetRect.maxY + 3;
            break;
        }
      }

      var startX = x,
      startY = y - 2,
      endX = targetRect.maxX - 1,
      endY = startY;
    }

    // set positions
    lineRect.setX(x);
    lineRect.setY(y);
    startRect.setX(startX);
    startRect.setY(startY);
    endRect.setX(endX);
    endRect.setY(endY);

    return {
      element: line,
      rect: lineRect
    };
  }
});

// label.js
SM.extend({
  setLabel: function( options ){
    var options = this.extend(options, {
      text: "Label",
      container: this.current,
      target: this.current
    }),
    container = options.container,
    styles = options.styles,
    target = options.target,
    placement = options.placement,
    shapeTemp = this.addShape(),
    textTemp = this.addText();

    if(styles){
      shapeTemp.setStyle(styles.layer);
      textTemp.setStyle(styles.text);
    }
    else{
      shape.style().addStylePartOfType(0);
    }

    var arrow = shapeTemp.duplicate(),
    box = shapeTemp.duplicate(),
    text = textTemp.duplicate();

    container.addLayers([arrow, box, text]);

    // set radius
    box.layers().firstObject().setCornerRadiusFromComponents("2")

      // set name
      arrow.setName("label-arrow");
    box.setName("label-box");
    text.setName("label-text");

    // set text
    text.setStringValue(options.text);
    text.setTextBehaviour(1);
    text.setTextBehaviour(0);

    // get rect
    var targetRect = this.getRect(target),
    arrowRect = this.getRect(arrow),
    boxRect = this.getRect(box),
    textRect = this.getRect(text);

    // rect function
    var x = targetRect.x + this.mathHalf(targetRect.width) - this.mathHalf(textRect.width),
    y = targetRect.y + this.mathHalf(targetRect.height) - this.mathHalf(textRect.height),
    arrowX = x - 4 + this.mathHalf(textRect.width + 8) - 4,
    arrowY = y - 4 + this.mathHalf(textRect.height + 8) - 4;

    if(!this.is(target, MSPage) && !this.is(target, MSArtboardGroup)){
      switch(placement){
        case "top":
          y = targetRect.y - textRect.height - 10;
          arrowY = y + textRect.height;
          break;
        case "right":
          x = targetRect.maxX + 10;
          arrowX = x - 8;
          break;
        case "bottom":
          y = targetRect.maxY + 10;
          arrowY = y - 8;
          break;
        case "left":
          x = targetRect.x - textRect.width - 10;
          arrowX = x + textRect.width;
          break;
      }
    }

    if(this.is(this.current, MSArtboardGroup)){
      var artboardRect = this.getRect(this.current);

      if( x - 4 < artboardRect.x){
        x = artboardRect.x + 4;
      }
      else if( x + textRect.width + 4 > artboardRect.maxX ){
        x = artboardRect.maxX - (textRect.width + 4);
      }
      else if( y - 4 < artboardRect.y ){
        y = artboardRect.y + 4;
      }
      else if( y + textRect.height + 4 > artboardRect.maxY ){
        y = artboardRect.maxY - (textRect.height + 4);
      }
    }

    textRect.setX(x);
    textRect.setY(y);

    boxRect.setX(x - 4);
    boxRect.setY(y - 4);
    boxRect.setWidth(textRect.width + 8);
    boxRect.setHeight(textRect.height + 8);

    arrow.setRotation(45);
    arrow.flatten();
    arrowRect.setWidth(8);
    arrowRect.setHeight(8);

    arrowRect.setX(arrowX);
    arrowRect.setY(arrowY);

    return {
      element: box,
      rect: boxRect
    };
  }
});
// ToolBar.js

SM.extend({
  ToolBar: function(){
    var self = this,
    identifier = "com.utom.measure",
    threadDictionary = NSThread.mainThread().threadDictionary(),
    ToolBar = threadDictionary[identifier];

    if(!ToolBar){
      ToolBar = NSPanel.alloc().init();
      ToolBar.setStyleMask(NSTitledWindowMask + NSFullSizeContentViewWindowMask);
      ToolBar.setBackgroundColor(NSColor.colorWithRed_green_blue_alpha(0.10, 0.10, 0.10, 1));
      ToolBar.setTitleVisibility(NSWindowTitleHidden);
      ToolBar.setTitlebarAppearsTransparent(true);

      ToolBar.setFrame_display(NSMakeRect(0, 0, 584, 48), false);
      ToolBar.setMovableByWindowBackground(true);
      ToolBar.becomeKeyWindow();
      ToolBar.setLevel(NSFloatingWindowLevel);

      var contentView = ToolBar.contentView(),
      getImage = function(size, name){
        var isRetinaDisplay = (NSScreen.mainScreen().backingScaleFactor() > 1)? true: false;
        suffix = (isRetinaDisplay)? "@2x": "",
        imageURL = NSURL.fileURLWithPath(self.pluginSketch + "/toolbar/" + name + suffix + ".png"),
        image = NSImage.alloc().initWithContentsOfURL(imageURL);

        return image
      },
      addButton = function(rect, name, callAction){
        var button = NSButton.alloc().initWithFrame(rect),
        image = getImage(rect.size, name);

        button.setImage(image);
        button.setBordered(false);
        button.sizeToFit();
        button.setButtonType(NSMomentaryChangeButton)
          button.setCOSJSTargetFunction(callAction);
        button.setAction("callAction:");
        return button;
      },
      addImage = function(rect, name){
        var view = NSImageView.alloc().initWithFrame(rect),
        image = getImage(rect.size, name);
        view.setImage(image);
        return view;
      },
      closeButton = addButton( NSMakeRect(14, 14, 20, 20), "icon-close",
          function(sender){
            coscript.setShouldKeepAround(false);
            threadDictionary.removeObjectForKey(identifier);
            ToolBar.close();
          }),
      overlayButton = addButton( NSMakeRect(64, 14, 20, 20), "icon-overlay",
          function(sender){
            self.updateContext();
            self.init(self.context, "mark-overlays");
          }),
      sizesButton = addButton( NSMakeRect(112, 14, 20, 20), "icon-sizes",
          function(sender){
            self.updateContext();
            if(NSEvent.modifierFlags() == NSAlternateKeyMask){
              self.init(self.context, "mark-sizes");
            }
            else{
              self.init(self.context, "lite-sizes");
            }
          }),
      spacingsButton = addButton( NSMakeRect(160, 14, 20, 20), "icon-spacings",
          function(sender){
            self.updateContext();
            if(NSEvent.modifierFlags() == NSAlternateKeyMask){
              self.init(self.context, "mark-spacings");
            }
            else{
              self.init(self.context, "lite-spacings");
            }
          }),
      propertiesButton = addButton( NSMakeRect(208, 14, 20, 20), "icon-properties",
          function(sender){
            self.updateContext();
            if(NSEvent.modifierFlags() == NSAlternateKeyMask){
              self.init(self.context, "mark-properties");
            }
            else{
              self.init(self.context, "lite-properties");
            }

          }),
      notesButton = addButton( NSMakeRect(258, 14, 20, 20), "icon-notes",
          function(sender){
            self.updateContext();
            self.init(self.context, "mark-note");
          }),
      exportableButton = addButton( NSMakeRect(306, 14, 20, 20), "icon-slice",
          function(sender){
            self.updateContext();
            self.init(self.context, "exportable");
          }),
      colorsButton = addButton( NSMakeRect(354, 14, 20, 20), "icon-colors",
          function(sender){
            self.updateContext();
            self.init(self.context, "color");
          }),
      exportButton = addButton( NSMakeRect(402, 14, 20, 20), "icon-export",
          function(sender){
            self.updateContext();
            self.init(self.context, "export");
          }),
      hiddenButton = addButton( NSMakeRect(452, 14, 20, 20), "icon-hidden",
          function(sender){
            self.updateContext();
            self.init(self.context, "hidden");
          }),
      lockedButton = addButton( NSMakeRect(500, 14, 20, 20), "icon-locked",
          function(sender){
            self.updateContext();
            self.init(self.context, "locked");
          }),
      settingsButton = addButton( NSMakeRect(548, 14, 20, 20), "icon-settings",
          function(sender){
            self.updateContext();
            self.init(self.context, "settings");
          }),
      divider1 = addImage( NSMakeRect(48, 8, 2, 32), "divider"),
      divider2 = addImage( NSMakeRect(242, 8, 2, 32), "divider"),
      divider3 = addImage( NSMakeRect(436, 8, 2, 32), "divider");

      contentView.addSubview(closeButton);
      contentView.addSubview(overlayButton);
      contentView.addSubview(sizesButton);
      contentView.addSubview(spacingsButton);
      contentView.addSubview(propertiesButton);

      contentView.addSubview(notesButton);
      contentView.addSubview(exportableButton);
      contentView.addSubview(colorsButton);
      contentView.addSubview(exportButton);

      contentView.addSubview(hiddenButton);
      contentView.addSubview(lockedButton);
      contentView.addSubview(settingsButton);

      contentView.addSubview(divider1);
      contentView.addSubview(divider2);
      contentView.addSubview(divider3);

      threadDictionary[identifier] = ToolBar;

      ToolBar.center();
      ToolBar.makeKeyAndOrderFront(nil);
    }


  }
})

// Panel.js
SM.extend({
  SMPanel: function(options){
    var self = this,
    options = this.extend(options, {
      url: this.pluginSketch + "/panel/settings.html",
      width: 240,
      height: 316,
      state: 1,
      floatWindow: false,
      data: {
        density: 2,
        unit: "dp/sp"
      },
      callback: function( data ){ return data; }
    }),
    result = false;
    options.url = encodeURI("file://" + options.url);

    var frame = NSMakeRect(0, 0, options.width, (options.height + 32)),
    titleBgColor = NSColor.colorWithRed_green_blue_alpha(.9, .9, .9, 1),
    contentBgColor = NSColor.colorWithRed_green_blue_alpha(1, 1, 1, 1);

    var Panel = NSPanel.alloc().init();
    Panel.title = "Draft";
    Panel.setTitleVisibility(NSWindowTitleVisible);
    Panel.setTitlebarAppearsTransparent(true);
    Panel.standardWindowButton(NSWindowCloseButton).setHidden(false);
    Panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
    Panel.standardWindowButton(NSWindowZoomButton).setHidden(true);
    Panel.setFrame_display(frame, false);
    Panel.setBackgroundColor(contentBgColor);

    var contentView = Panel.contentView(),
    webView = WebView.alloc().initWithFrame(NSMakeRect(0, 0, options.width, options.height)),
    windowObject = webView.windowScriptObject(),
    delegate = new MochaJSDelegate({
      "webView:didFinishLoadForFrame:": (function(webView, webFrame){
        var SMAction = [
          "function SMAction(data){",
          "window.SMData = encodeURI(JSON.stringify(data));",
          "window.location.hash = 'submit';",
          // "console.log(SMData)",
          "}",
          "function SMImportAction(data){",
          "window.location.hash = 'import';",
          // "console.log(SMData)",
          "}"
        ].join(""),
        DOMReady = [
          "$(",
          "function(){",
          "init(" + JSON.stringify(options.data) + ")",
          "}",
          ");"
        ].join("");

        windowObject.evaluateWebScript(SMAction);
        windowObject.evaluateWebScript(language);
        windowObject.evaluateWebScript(DOMReady);
      }),
      "webView:didChangeLocationWithinPageForFrame:": (function(webView, webFrame){
        var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();

        if( options.state ){
          Panel.orderOut(nil);
          NSApp.stopModal();
          if(request == "submit"){
            var data = JSON.parse(decodeURI(windowObject.valueForKey("SMData")));
            options.callback(data);
            result = true;
          }
        }
        else if(request == "import"){
          if( options.importCallback(Panel, NSApp) ){
            self.message(_("Import complete!"));
          }
          else{
            windowObject.evaluateWebScript("window.location.hash = '';");
          }
        }
        else if(request == "complete"){

        }
      })
    });

    contentView.setWantsLayer(true);
    contentView.layer().setFrame( contentView.frame() );
    contentView.layer().setCornerRadius(6);
    contentView.layer().setMasksToBounds(true);

    webView.setBackgroundColor(contentBgColor);
    webView.setFrameLoadDelegate_(delegate.getClassInstance());
    webView.setMainFrameURL_(options.url);

    contentView.addSubview(webView);

    var closeButton = Panel.standardWindowButton(NSWindowCloseButton);
    closeButton.setCOSJSTargetFunction(function(sender) {
      var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();
      if(options.state == 0 && request == "submit"){
        data = JSON.parse(decodeURI(windowObject.valueForKey("SMData")));
        options.callback(data);
      }
      self.wantsStop = true;
      Panel.orderOut(nil);
      NSApp.stopModal();
      // NSApp.endSheet(sender.window());
    });
    closeButton.setAction("callAction:");

    var titlebarView = contentView.superview().titlebarViewController().view(),
    titlebarContainerView = titlebarView.superview();
    closeButton.setFrameOrigin(NSMakePoint(8, 8));
    titlebarContainerView.setFrame(NSMakeRect(0, options.height, options.width, 32));
    titlebarView.setFrameSize(NSMakeSize(options.width, 32));
    titlebarView.setTransparent(true);
    titlebarView.setBackgroundColor(titleBgColor);
    titlebarContainerView.superview().setBackgroundColor(titleBgColor);

    if(options.floatWindow){
      Panel.becomeKeyWindow();
      Panel.setLevel(NSFloatingWindowLevel);
      Panel.center();
      Panel.orderFront(NSApp.mainWindow());
      return webView;
    }
    else{
      NSApp.runModalForWindow(Panel);
    }

    return result;
  },
  settingsPanel: function(){
    var self = this,
    data = {};

    if(this.configs){
      data.scale = this.configs.scale;
      data.unit = this.configs.unit;
      data.colorFormat = this.configs.colorFormat;
    }

    return this.SMPanel({
      width: 440,
      height: 380,
      data: data,
      callback: function( data ){
        self.configs = self.setConfigs(data);
      }
    });

  },
  sizesPanel: function(){
    var self = this,
    data = {};

    if(this.configs.sizes && this.configs.sizes.widthPlacement) data.widthPlacement = this.configs.sizes.widthPlacement;
    if(this.configs.sizes && this.configs.sizes.heightPlacement) data.heightPlacement = this.configs.sizes.heightPlacement;
    if(this.configs.sizes && this.configs.sizes.byPercentage) data.byPercentage = this.configs.sizes.byPercentage;

    return this.SMPanel({
      url: this.pluginSketch + "/panel/sizes.html",
      width: 440,
      height: 320,
      data: data,
      callback: function( data ){
        self.configs = self.setConfigs({
          sizes: data
        });
      }
    });
  },
  spacingsPanel: function(){
    var self = this,
    data = {};

    data.placements = (this.configs.spacings && this.configs.spacings.placements)? this.configs.spacings.placements: ["top", "left"];
    if(this.configs.spacings && this.configs.spacings.byPercentage) data.byPercentage = this.configs.spacings.byPercentage;

    return this.SMPanel({
      url: this.pluginSketch + "/panel/spacings.html",
      width: 240,
      height: 314,
      data: data,
      callback: function( data ){
        self.configs = self.setConfigs({
          spacings: data
        });
      }
    });
  },
  loginPanel: function(){
    var self = this,
    data = {};
    return this.SMPanel({
      url: this.pluginSketch + "/panel/login.html",
      width: 440,
      height: 500,
      data: data,
      callback: function( data ){
        log("loginPanel()");
        log(data.accessToken);
        self.saveAccessToken(data.accessToken);
      }
    });
  },
  alreadyLoggedPanel: function() {
    var self = this,
    data = {};
    return this.SMPanel({
      url: this.pluginSketch + "/panel/alreadyLogged.html",
      width: 304,
      height: 134,
      data,
      callback: function( data ){}
    });
  },
  loggedoutPanel: function() {
    var self = this,
    data = {};
    return this.SMPanel({
      url: this.pluginSketch + "/panel/loggedout.html",
      width: 304,
      height: 134,
      data,
      callback: function( data ){}
    });
  },
  propertiesPanel: function(){
    var self = this,
    data = (this.configs.properties)? this.configs.properties: {
      placement: "top",
      properties: ["color", "border"]
    };
    return this.SMPanel({
      url: this.pluginSketch + "/panel/properties.html",
      width: 280,
      height: 354,
      data: data,
      callback: function( data ){
        self.configs = self.setConfigs({
          properties: data
        });
      }
    });
  }
});

// mark-base.js
SM.extend({
  sizes: function( options ){
    var options = this.extend(options, {}),
    name = options.name,
    type = options.type,
    placement = options.placement,
    byPercentage = options.byPercentage,
    styles = options.styles,
    target = options.target,
    targetRect = this.getRect(target),
    container = this.find({key: "(name != NULL) && (name == %@)", match: name});

    if (container) this.removeLayer(container);
    container = this.addGroup();
    this.current.addLayers([container]);
    container.setName(name);

    var length = (type == "height")? targetRect.height: targetRect.width,
    percentageType = (byPercentage && type == "width")? "width":
      (byPercentage && type == "height")? "height":
      undefined,
    text = this.convertUnit(length, false, percentageType),
    temp = this.addText();

    temp.setStringValue(text);
    temp.setTextBehaviour(1);
    temp.setTextBehaviour(0);
    temp.setStyle(styles.text);

    var tempRect = this.getRect(temp),
    ruler = this.setRuler({
      type: type,
      placement: placement,
      styles: styles,
      target: target,
      container: container
    }),
    distance = this.getDistance(ruler.rect),
    markPlacement = (type == "height")? (
        ( ruler.rect.height > (tempRect.height + 28) )? "center":
        ( placement == "right" )? "right":
        ( placement == "left" )? "left":
        ( distance.right >= distance.left )? "right":
        "left"
        ):
      (
       ( ruler.rect.width > (tempRect.width + 28) )? "middle":
       ( placement == "bottom" )? "bottom":
       ( placement == "top" )? "top":
       ( distance.top >= distance.bottom )? "top":
       "bottom"
      );

    var label = this.setLabel({
      container: container,
      target: ruler.element,
      styles: styles,
      text: text,
      placement: markPlacement
    });

    this.removeLayer(temp);
    container.resizeToFitChildrenWithOption(0);
  },
  spacings: function( options ){
    var options = this.extend(options, {}),
    placement = options.placement,
    styles = options.styles,
    target = options.target,
    layer = options.layer,
    byPercentage = options.byPercentage,
    targetObjectID = target.objectID(),
    layerObjectID = layer.objectID(),
    objectID = targetObjectID + "#" + layerObjectID,
    prefix = placement.toUpperCase() + "#",
    sizeType = (placement == "top" || placement == "bottom")? "height": "width",
    targetRect = this.getRect(target),
    layerRect = this.getRect(layer),
    distance = this.getDistance(targetRect, layerRect),
    isIntersect = this.isIntersect(targetRect, layerRect),
    tempX = targetRect.x,
    tempY = targetRect.y,
    tempWidth = targetRect.width,
    tempHeight = targetRect.height,
    render = true;

    if( this.is(layer, MSPage) ) return false;

    if(isIntersect){
      switch(placement){
        case "top":
          tempY = targetRect.y - distance.top;
          tempHeight = distance.top;
          break;
        case "right":
          tempX = targetRect.x + targetRect.width;
          tempWidth = distance.right;
          break;
        case "bottom":
          tempY = targetRect.y + targetRect.height;
          tempHeight = distance.bottom;
          break;
        case "left":
          tempX = targetRect.x - distance.left;
          tempWidth = distance.left;
          break;
        default:
          render = false;
          break;
      }
      if(!tempWidth || !tempHeight){
        render = false;
      }
    }
    else{
      switch(placement){
        case "left" || "right":
          prefix = "HORIZONTAL#";
          if(targetRect.maxX <  layerRect.x ){
            tempX = targetRect.maxX;
            tempWidth = layerRect.x - targetRect.maxX;
          }
          else if( targetRect.x > layerRect.maxX ){
            tempX = layerRect.maxX;
            tempWidth = targetRect.x - layerRect.maxX;
          }
          else{
            render = false;
          }
          break;
        case "top" || "bottom":
          prefix = "VERTICAL#";
          if(targetRect.maxY <  layerRect.y ){
            tempY = targetRect.maxY;
            tempHeight = layerRect.y - targetRect.maxY;
          }
          else if( targetRect.y > layerRect.maxY ){
            tempY = layerRect.maxY;
            tempHeight = targetRect.y - layerRect.maxY;
          }
          else{
            render = false;
          }
          break;
        default:
          render = false;
          break;
      }
    }

    if(render){
      var temp = this.addShape(),
        tempRect = this.getRect(temp);
      this.current.addLayers([temp]);

      tempRect.setX(tempX);
      tempRect.setY(tempY);
      tempRect.setWidth(tempWidth);
      tempRect.setHeight(tempHeight);

      this.sizes({
        name: prefix + objectID,
        type: sizeType,
        target: temp,
        styles: styles,
        byPercentage: byPercentage
      });

      this.removeLayer(temp);
    }
  }
});


SM.extend({
  overlay: function(target){
    var targetRect = this.getRect(target),
    name = "OVERLAY#" + target.objectID(),
    container = this.find({key: "(name != NULL) && (name == %@)", match: name}),
    overlayStyle = this.sharedLayerStyle("@Overlay / Layer", this.colors.overlay.layer);

    if (container) this.removeLayer(container);
    container = this.addGroup();
    this.current.addLayers([container]);
    container.setName(name);

    var overlay = this.addShape(),
    overlayRect = this.getRect(overlay);

    container.addLayers([overlay]);

    overlay.setStyle(overlayStyle);
    overlay.setName("overlay");
    overlayRect.setX(targetRect.x);
    overlayRect.setY(targetRect.y);
    overlayRect.setWidth(targetRect.width);
    overlayRect.setHeight(targetRect.height);

    container.resizeToFitChildrenWithOption(0);
  }
});

// properties.js
SM.extend({
  fillTypeContent: function( fillJSON ){
    var self = this,
    fillJSON = fillJSON;

    if(fillJSON.fillType == "color"){
      var colorID = fillJSON.color["argb-hex"];
      return (self.configs.colorNames && self.configs.colorNames[colorID])? self.configs.colorNames[colorID]: fillJSON.color[self.configs.colorFormat];
    }

    if(fillJSON.fillType == "gradient"){
      var fc = [];
      fc.push(fillJSON.gradient.type)
        fillJSON.gradient.colorStops.forEach(function(gradient){
          var colorID = gradient.color["argb-hex"],
          color = (self.configs.colorNames && self.configs.colorNames[colorID])? self.configs.colorNames[colorID]: gradient.color[self.configs.colorFormat];
          fc.push(" * " + color);
        });
      return fc.join("\r\n");
    }
  },
  shadowContent: function(shadow){
    var shadowJSON = this.shadowToJSON(shadow),
    sc = [];
    if(shadowJSON <= 0) return false;

    sc.push(" * x, y - " + this.convertUnit(shadowJSON.offsetX) + ", " + this.convertUnit(shadowJSON.offsetY) );
    if(shadowJSON.blurRadius) sc.push(" * blur - " + this.convertUnit(shadowJSON.blurRadius) );
    if(shadowJSON.spread) sc.push(" * spread - " + this.convertUnit(shadowJSON.spread) );
    return sc.join("\r\n")
  },
  properties: function( options ){
    var self = this,
    options = this.extend(options, {
      placement: "top",
      properties: ["color", "border", "opacity", "radius", "shadow", "font-size", "line-height", "font-face", "character", "paragraph"]
    }),
    properties = options.properties,
    placement = options.placement,
    styles = {
      layer: this.sharedLayerStyle("@Property / Layer", this.colors.property.layer),
      text: this.sharedTextStyle("@Property / Text", this.colors.property.text)
    },
    target = options.target,
    targetStyle = target.style(),
    content = [];

    properties.forEach(function(property){
      switch(property){
        case "color":
          var fill, color;
          if( self.is(target, MSTextLayer) ){
            var color = self.colorToJSON( target.textColor() ),
              colorID = color["argb-hex"];
            color = ( self.configs.colorNames && self.configs.colorNames[colorID] )? self.configs.colorNames[colorID]: color[self.configs.colorFormat];
            content.push("color: " + color);
          }
          else if( self.is(target, MSShapeGroup) ){
            var fillsJSON = self.getFills(targetStyle);
            if(fillsJSON.length <= 0) return false;
            var fillJSON = fillsJSON.pop();
            content.push("fill: " + self.fillTypeContent(fillJSON))
          }

          break;
        case "border":
          var bordersJSON = self.getBorders(targetStyle);
          if(bordersJSON.length <= 0) return false;
          var borderJSON = bordersJSON.pop();
          content.push("border: " + self.convertUnit(borderJSON.thickness) + " " + borderJSON.position + "\r\n * " + self.fillTypeContent(borderJSON) );
          break;
        case "opacity":
          content.push("opacity: " + Math.round( targetStyle.contextSettings().opacity() * 100) + "%");
          break;
        case "radius":
          if(self.is(target, MSShapeGroup) && self.is(target.layers().firstObject(), MSRectangleShape)){
            content.push("radius: " + self.convertUnit( self.getRadius(target) ) );
          }
          break;
        case "shadow":
          if(targetStyle.shadow() || (targetStyle.shadow() && targetStyle.shadow().isEnabled()) ){
            content.push("shadow: outer\r\n" + self.shadowContent(targetStyle.shadow()));
          }

          if(targetStyle.innerShadow() || (targetStyle.innerShadow() && targetStyle.innerShadow().isEnabled()) ){
            content.push("shadow: inner\r\n" + self.shadowContent(targetStyle.innerShadow()));
          }
          break;
        case "font-size":
          if(!self.is(target, MSTextLayer)) return false;
          content.push("font-size: " + self.convertUnit(target.fontSize(), true) );
          break;
        case "line-height":
          if(!self.is(target, MSTextLayer)) return false;
          content.push("line: " + self.convertUnit(target.lineSpacing(), true) + " (" + Math.round(target.lineSpacing() / target.fontSize() * 10) / 10  + ")" );
          break;
        case "font-face":
          if(!self.is(target, MSTextLayer)) return false;
          content.push("font-face: " + target.fontPostscriptName());
          break;
        case "character":
          if(!self.is(target, MSTextLayer)) return false;
          content.push("character: " + self.convertUnit(target.characterSpacing(), true) );
          break;
        case "paragraph":
          if(!self.is(target, MSTextLayer)) return false;
          content.push("paragraph: " + self.convertUnit(target.paragraphStyle().paragraphSpacing(), true));
          break;
        case "style-name":
          var styleName = self.getStyleName(target);
          if(styleName){
            content.push("style-name: " + styleName);
          }
          break;
        default:
          render = false;
          break;
      }
    });

    var objectID = target.objectID(),
    name = "PROPERTY#" + objectID,
    container = this.find({key: "(name != NULL) && (name == %@)", match: name});

    if (container) this.removeLayer(container);
    container = this.addGroup();
    this.current.addLayers([container]);
    container.setName(name);

    var label = this.setLabel({
      container: container,
      target: target,
      styles: styles,
      text: content.join("\r\n"),
      placement: placement
    });

    this.setConfigs({placement: placement}, container);

    container.resizeToFitChildrenWithOption(0);
  }
});

// marks.js
SM.extend({
  markOverlays: function(){
    var self = this,
    selection = this.selection;

    if( selection.count() <= 0 ){
      this.message(_("Select a layer to make marks!"));
      return false;
    }
    for (var i = 0; i < selection.count(); i++) {
      this.overlay(selection[i]);
    }
  },
  markSizes: function(){
    var self = this,
    selection = this.selection;


    if( selection.count() <= 0 ){
      this.message(_("Select a layer to make marks!"));
      return false;
    }

    if(this.sizesPanel()){
      var sizeStyles = {
        layer: this.sharedLayerStyle("@Size / Layer", this.colors.size.layer),
        text: this.sharedTextStyle("@Size / Text", this.colors.size.text, 2)
      };

      for (var i = 0; i < selection.count(); i++) {
        var target = selection[i],
          objectID = target.objectID();

        if(this.configs.sizes.widthPlacement){
          this.sizes({
            name: "WIDTH#" + objectID,
            type: "width",
            target: target,
            placement: this.configs.sizes.widthPlacement,
            styles: sizeStyles,
            byPercentage: this.configs.sizes.byPercentage
          });
        }

        if(this.configs.sizes.heightPlacement){
          this.sizes({
            name: "HEIGHT#" + objectID,
            type: "height",
            target: target,
            placement: this.configs.sizes.heightPlacement,
            styles: sizeStyles,
            byPercentage: this.configs.sizes.byPercentage
          });
        }
      }
    }
  },
  markSpacings: function(){
    var self = this,
    selection = this.selection;

    if( !(selection.count() > 0 && selection.count() < 3) ){
      this.message(_("Select 1 or 2 layers to make marks!"));
      return false;
    }

    if(this.spacingsPanel()){
      var target = (selection.count() == 1)? selection[0]: selection[1],
        layer = (selection.count() == 1)? this.current: selection[0],
        placements = ["top", "right", "bottom", "left"],
        spacingStyles = {
          layer: this.sharedLayerStyle("@Spacing / Layer", this.colors.spacing.layer),
          text: this.sharedTextStyle("@Spacing / Text", this.colors.spacing.text, 2)
        };

        if( this.isIntersect(this.getRect(target), this.getRect(layer)) ){
          placements = this.configs.spacings.placements;
        }

        placements.forEach(function(placement) {
          self.spacings({
            target: target,
            layer: layer,
            placement: placement,
            styles: spacingStyles,
            byPercentage: self.configs.spacings.byPercentage
          });
        });
    }
  },
  markProperties: function(){
    var self = this,
    selection = this.selection;

    if( selection.count() <= 0 ){
      this.message(_("Select a layer to make marks!"));
      return false;
    }

    var target = selection[0];

    if(!this.propertiesPanel()) return false;

    for (var i = 0; i < selection.count(); i++) {
      var target = selection[i];
      this.properties({
        target: target,
        placement: this.configs.properties.placement,
        properties: this.configs.properties.properties
      });
    }
  },
  liteSizes: function(){
    var self = this,
    selection = this.selection;

    if( selection.count() <= 0 ){
      this.message(_("Select a layer to make marks!"));
      return false;
    }

    var sizeStyles = {
      layer: this.sharedLayerStyle("@Size / Layer", this.colors.size.layer),
      text: this.sharedTextStyle("@Size / Text", this.colors.size.text, 2)
    };

    for (var i = 0; i < selection.count(); i++) {
      var target = selection[i],
        targetRect = self.getRect(target),
        objectID = target.objectID(),
        distance = self.getDistance(targetRect),
        widthPlacement =
          distance.top < distance.bottom? "bottom":
          distance.top == distance.bottom? "middle":
          "top",
        heightPlacement =
          distance.left > distance.right? "left":
          distance.left == distance.right? "center":
          "right";

      this.sizes({
        name: "WIDTH#" + objectID,
        type: "width",
        target: target,
        placement: widthPlacement,
        styles: sizeStyles,
        byPercentage: false
      });

      this.sizes({
        name: "HEIGHT#" + objectID,
        type: "height",
        target: target,
        placement: heightPlacement,
        styles: sizeStyles,
        byPercentage: false
      });

    }
  },
  liteSpacings: function(){
    var self = this,
    selection = this.selection;

    if( !(selection.count() > 0 && selection.count() < 3) ){
      this.message(_("Select 1 or 2 layers to make marks!"));
      return false;
    }

    var target = (selection.count() == 1)? selection[0]: selection[1],
    layer = (selection.count() == 1)? this.current: selection[0],
    spacingStyles = {
      layer: this.sharedLayerStyle("@Spacing / Layer", this.colors.spacing.layer),
      text: this.sharedTextStyle("@Spacing / Text", this.colors.spacing.text, 2)
    },
    placements = ["top", "right", "bottom", "left"];

    placements.forEach(function(placement) {
      self.spacings({
        target: target,
        layer: layer,
        placement: placement,
        styles: spacingStyles,
        byPercentage: false
      });
    });
  },
  liteProperties: function(){
    var self = this,
    selection = this.selection;

    if( selection.count() <= 0 ){
      this.message(_("Select a layer to make marks!"));
      return false;
    }

    var target = selection[0];

    if( /PROPERTY\#/.exec(target.parentGroup().name()) ){
      this.resizeProperties(target.parentGroup());
    }
    else{
      for (var i = 0; i < selection.count(); i++) {
        var target = selection[i],
          targetRect = this.getRect(target),
          distance = this.getDistance(targetRect),
          placement = {};

        placement[distance.right] = "right";
        placement[distance.bottom] = "bottom";
        placement[distance.left] = "left";
        placement[distance.top] = "top";

        this.properties({
          target: target,
          placement: placement[ Math.max(distance.top, distance.right, distance.bottom, distance.left) ],
          properties: ["color", "border", "opacity", "radius", "shadow", "font-size", "font-face", "character", "line-height"]
        });
      }
    }
  },
  markNote: function(){
    var self = this,
    selection = this.selection;

    if( selection.count() <= 0 ){
      this.message(_("Select a text layer to make marks!"));
      return false;
    }

    var target = selection[0];

    if( /NOTE\#/.exec(target.parentGroup().name()) && this.is(target, MSTextLayer) ){
      this.resizeNote(target.parentGroup());
    }
    else{
      for (var i = 0; i < selection.count(); i++) {
        var target = selection[i];
        if(this.is(target, MSTextLayer)){
          this.note(target);
        }
      }
    }
  },
  note: function(target){
    var targetRect = this.getRect(target),
    objectID = target.objectID(),
    noteStyle = {
      layer: this.sharedLayerStyle("@Note / Layer", this.colors.note.layer, this.colors.note.border),
      text: this.sharedTextStyle("@Note / Text", this.colors.note.text)
    },
    container = this.addGroup();

    this.current.addLayers([container]);
    container.setName("NOTE#" + new Date().getTime());

    var note = this.addShape(),
    text = this.addText();

    container.addLayers([note, text]);

    note.setName("note-box");
    note.layers().firstObject().setCornerRadiusFromComponents("2")

      text.setStringValue(target.storage().string());
    text.setTextBehaviour(1);
    text.setTextBehaviour(0);
    note.setStyle(noteStyle.layer);
    text.setStyle(noteStyle.text);

    var noteRect = this.getRect(note),
    textRect = this.getRect(text),
    fontSize = text.fontSize(),
    scale = fontSize / 12;

    if(textRect.width > 160 * scale){
      text.setTextBehaviour(1);
      textRect.setWidth(160 * scale);
      text.finishEditing();
      textRect = this.getRect(text);
    }

    textRect.setX(targetRect.x);
    textRect.setY(targetRect.y);
    noteRect.setX(textRect.x - 6 * scale);
    noteRect.setY(textRect.y - 6 * scale);
    noteRect.setWidth(textRect.width + 12 * scale);
    noteRect.setHeight(textRect.height + 12 * scale);

    container.resizeToFitChildrenWithOption(0);
    this.removeLayer(target);
  }
});

// resize.js
SM.extend({
  resizeProperties: function(container){
    var configs = this.getConfigs(container),
    placement = configs.placement,
    text = this.find({key: "(class != NULL) && (class == %@)", match: MSTextLayer}, container),
    label = this.find({key: "(name != NULL) && (name == %@)", match: "label-box"}, container),
    textRect = this.getRect(text),
    labelRect = this.getRect(label),
    oldWidth = labelRect.width,
    oldHeight = labelRect.height,
    newWidth = textRect.width + 8,
    newHeight = textRect.height + 8,
    dWidth = newWidth - oldWidth,
    dHeight = newHeight - oldHeight,
    dHalfWidth =  this.mathHalf(dWidth),
    dHalfHeight = this.mathHalf(dHeight),
    lx = labelRect.x,
    ly = labelRect.y,
    lw = labelRect.width,
    lh = labelRect.height,
    tx = textRect.x,
    ty = textRect.y,
    tw = textRect.width,
    th = textRect.height;

    if(!dWidth && !dHeight) return false;

    switch(placement){
      case "top":
        lx = lx - dHalfWidth;
        ly = ly - dHeight;
        lw = lw + dWidth;
        lh = lh + dHeight;
        tx = tx - dHalfWidth;
        ty = ty - dHeight;
        break;
      case "right":
        ly = ly - dHalfHeight;
        lw = lw + dWidth;
        lh = lh + dHeight;
        ty = ty - dHalfHeight;
        break;
      case "bottom":
        lx = lx - dHalfWidth;
        lw = lw + dWidth;
        lh = lh + dHeight;
        tx = tx - dHalfWidth;
        break;
      case "left":
        lx = lx - dWidth;
        ly = ly - dHalfHeight;
        lw = lw + dWidth;
        lh = lh + dHeight;
        tx = tx - dWidth;
        ty = ty - dHalfHeight;
        break;
    }

    labelRect.setX( lx );
    labelRect.setY( ly );
    labelRect.setWidth( lw );
    labelRect.setHeight( lh );

    textRect.setX( tx );
    textRect.setY( ty );

    text.setTextBehaviour(1);
    text.setTextBehaviour(0);

    container.resizeToFitChildrenWithOption(0);
  },
  resizeNote: function(container) {
    var text = this.find({key: "(class != NULL) && (class == %@)", match: MSTextLayer}),
    label = this.find({key: "(name != NULL) && (name == %@)", match: "note-box"}),
    textRect = this.getRect(text),
    labelRect = this.getRect(label),
    oldWidth = labelRect.width,
    oldHeight = labelRect.height,
    newWidth = textRect.width + 12,
    newHeight = textRect.height + 12,
    dWidth = newWidth - oldWidth,
    dHeight = newHeight - oldHeight;

    if(!dWidth && !dHeight) return false;

    labelRect.setX( labelRect.x - this.mathHalf(dWidth) );
    labelRect.setY( labelRect.y - this.mathHalf(dHeight) );
    labelRect.setWidth( newWidth );
    labelRect.setHeight( newHeight );

    textRect.setX( textRect.x - this.mathHalf(dWidth) );
    textRect.setY( textRect.y - this.mathHalf(dHeight) );

    text.setTextBehaviour(1);
    text.setTextBehaviour(0);

    container.resizeToFitChildrenWithOption(0);
  }
});

// colors.js
SM.extend({
  getSelectionColor: function(){
    var self = this,
    colors = [];

    for (var i = 0; i < this.selection.count(); i++) {
      var layer = this.selection[i];
      if ( !this.is(layer, MSSliceLayer) ) {
        var layerStyle = layer.style(),
          fills = this.getFills(layerStyle),
          borders = this.getBorders(layerStyle);

        for (var n = 0; n < fills.length; n++) {
          var fill = fills[n];
          if(fill.fillType != "gradient"){
            colors.push(fill.color);
          }
          else{
            for (var w = 0; w < fill.gradient.colorStops.length; w++) {
              var gColor = fill.gradient.colorStops[w];
              colors.push(gColor.color);
            }
          }
        }

        for (var n = 0; n < borders.length; n++) {
          var border = borders[n];
          if(border.fillType != "gradient"){
            colors.push(border.color);
          }
          else{
            for (var w = 0; w < border.gradient.colorStops.length; w++) {
              var gColor = border.gradient.colorStops[w];
              colors.push(gColor.color);
            }
          }
        }
      }

      if ( this.is(layer, MSTextLayer) ) {
        colors.push(this.colorToJSON(layer.textColor()));

      }
    };

    return colors;
  },
  colorNames: function(colors){
    var colorNames = {};

    colors.forEach(function(color){
      var colorID = color.color["argb-hex"];
      colorNames[colorID] = color.name;
    });
    return colorNames;
  },
  manageColors: function(){
    var self = this,
    data = {};

    data.list = (this.configs.colors)? this.configs.colors: [];

    data.add = this.getSelectionColor();

    return this.SMPanel({
      url: this.pluginSketch + "/panel/colors.html",
      width: 240,
      height: 323,
      state: 0,
      data: data,
      callback: function( data ){
        var colors = data;
        self.configs = self.setConfigs({
          colors: colors,
          colorNames: self.colorNames(colors)
        });

      },
      importCallback: function(SMPanel, NSApp){
        var colors = self.importColors();
        if( colors ){
          self.configs = self.setConfigs({
            colors: colors,
            colorNames: self.colorNames(colors)
          });
          SMPanel.orderOut(nil);
          NSApp.stopModal();
          self.manageColors();
          return true;
        }
        else{
          return false;
        }
      }
    });
  },
  importColors: function(SMPanel){
    var openPanel = NSOpenPanel.openPanel();
    openPanel.setCanChooseDirectories(false);
    openPanel.setCanCreateDirectories(false);
    openPanel.setDirectoryURL(NSURL.fileURLWithPath("~/Documents/"));
    openPanel.setTitle(_("Choose a &quot;colors.json&quot;"));
    openPanel.setPrompt(_("Choose"));
    openPanel.setAllowedFileTypes(NSArray.arrayWithObjects("json"))

      if (openPanel.runModal() != NSOKButton) {
        return false;
      }
    var colors = JSON.parse(NSString.stringWithContentsOfFile_encoding_error(openPanel.URL().path(), NSUTF8StringEncoding, nil)),
    colorsData = [];

    colors.forEach(function(color){
      if(color.name && ( color.color && color.color.a && color.color.r && color.color.g && color.color.b && color.color["argb-hex"] && color.color["color-hex"] && color.color["css-rgba"] && color.color["ui-color"]) ){
        colorsData.push(color);
      }
    });

    if(colorsData.length <= 0){
      return false;
    }
    return colorsData;

  }
})

// exportable.js
SM.extend({
  makeExportable: function(){
    if( this.selection.count() <= 0 ){
      this.message(_("Select a layer to add exportable!"));
      return false;
    }


    for (var i = 0; i < this.selection.count(); i++) {
      var layer = this.selection[i];
      layer.exportOptions().removeAllExportFormats();

      var formats = [
      {
        scale: 1 / this.configs.scale,
        suffix: ""
      },
      {
        scale: 1.5 / this.configs.scale,
        suffix: "@1.5x"
      },
      {
        scale: 2 / this.configs.scale,
        suffix: "@2x"
      },
      {
        scale: 3 / this.configs.scale,
        suffix: "@3x"
      }
      ];

      for(format of formats) {
        var size = layer.exportOptions().addExportFormat();
        size.setName(format.suffix);
        size.setScale(format.scale);
      };

      layer.exportOptions().addExportFormat();
      layer.exportOptions().removeExportFormatAtIndex(layer.exportOptions().exportFormats().count() - 1);
      layer.setIsSelected(0);
      layer.setIsSelected(1);

    };


  }
});

// export.js
SM.extend({
  slices: [],
  sliceCache: {},
  maskCache: [],
  hasExportSizes: function(layer){
    return layer.exportOptions().exportFormats().count() > 0;
  },
  isSliceGroup: function(layer) {
    return this.is(layer, MSLayerGroup) && this.hasExportSizes(layer);
  },
  isExportable: function(layer) {
    return this.is(layer, MSTextLayer) ||
      this.is(layer, MSShapeGroup) ||
      this.is(layer, MSBitmapLayer) ||
      this.is(layer, MSSliceLayer) ||
      this.is(layer, MSSymbolInstance) ||
      this.isSliceGroup(layer)
  },
  getStates: function(layer){
    var isVisible = true,
    isLocked = false,
    hasSlice = false,
    isEmpty = false,
    isMaskChildLayer = false,
    isMeasure = false;

    while (!( this.is(layer, MSArtboardGroup) || this.is(layer, MSSymbolMaster) ) ) {
      var group = layer.parentGroup();

      if( this.regexNames.exec(group.name()) ){
        isMeasure = true;
      }

      if (!layer.isVisible()) {
        isVisible = false;
      }

      if (layer.isLocked()) {
        isLocked = true;
      }

      if ( this.is(group, MSLayerGroup) && this.hasExportSizes(group) ) {
        hasSlice = true
      }

      if (
          this.maskObjectID &&
          group.objectID() == this.maskObjectID &&
          !layer.shouldBreakMaskChain()
         ) {
        isMaskChildLayer = true
      }

      if (
          this.is(layer, MSTextLayer) &&
          layer.isEmpty()
         ) {
        isEmpty = true
      }

      layer = group;
    }
    return {
      isVisible: isVisible,
      isLocked: isLocked,
      hasSlice: hasSlice,
      isMaskChildLayer: isMaskChildLayer,
      isMeasure: isMeasure,
      isEmpty: isEmpty
    }
  },
  checkMask: function(group, layer, layerData, layerStates){
    if(layer.hasClippingMask()){
      if(layerStates.isMaskChildLayer){
        this.maskCache.push({
          objectID: this.maskObjectID,
          rect: this.maskRect
        });
      }
      this.maskObjectID = group.objectID();
      this.maskRect = layerData.rect;
    }
    else if( !layerStates.isMaskChildLayer && this.maskCache.length > 0 ){
      var mask = this.maskCache.pop();
      this.maskObjectID = mask.objectID;
      this.maskRect = mask.rect;
      layerStates.isMaskChildLayer = true;
    }
    else if ( !layerStates.isMaskChildLayer ) {
      this.maskObjectID = undefined;
      this.maskRect = undefined;
    }

    if (layerStates.isMaskChildLayer){
      var layerRect = layerData.rect,
        maskRect = this.maskRect;

      layerRect.maxX = layerRect.x + layerRect.width;
      layerRect.maxY = layerRect.y + layerRect.height;
      maskRect.maxX = maskRect.x + maskRect.width;
      maskRect.maxY = maskRect.y + maskRect.height;

      var distance = this.getDistance(layerRect, maskRect),
      width = layerRect.width,
      height = layerRect.height;

      if(distance.left < 0) width += distance.left;
      if(distance.right < 0) width += distance.right;
      if(distance.top < 0) height += distance.top;
      if(distance.bottom < 0) height += distance.bottom;

      layerData.rect = {
        x: ( distance.left < 0 )? maskRect.x: layerRect.x,
        y: ( distance.top < 0 )? maskRect.y: layerRect.y,
        width: width,
        height: height
      }

    }
  },
  getExportable: function(layer, savePath){
    var self = this,
    exportable = [],
    size, sizes = layer.exportOptions().exportFormats(),
    sizesInter = sizes.objectEnumerator();

    var androidDensity = {
      "@0.75x": "ldpi",
      "@1x": "mdpi",
      "@1.5x": "hdpi",
      "@2x": "xhdpi",
      "@3x": "xxhdpi",
      "@4x": "xxxhdpi"
    }

    while (size = sizesInter.nextObject()) {

      var size = this.toJSString(size).split(" "),
      scale = self.toJSNumber(size[0]),
      format = size[2],
      suffix = this.toJSString(size[1]),
      suffix = suffix || "",
      density = suffix,
      drawablePath = "";

      if( sizes.count() == 1 && self.configs.scale != 1 && !density ){
        suffix = "@" + self.configs.scale + "x";
        density = suffix;
      }

      if( ( ( sizes.count() == 1 && scale == 1 && self.configs.scale == 1 ) && !density ) || ( sizes.count() > 1 && !density ) ){
        density = "@1x";
      }

      // Android
      if(self.configs.unit == "dp/sp"){
        drawablePath = "drawable-" + androidDensity[density] + "/";
        density = androidDensity[density];
        suffix = "";
      }

      this.exportImage({
        layer: layer,
        path: self.assetsPath,
        scale: scale,
        name: drawablePath + layer.name(),
        suffix: suffix,
        format: format
      });

      exportable.push({
        name: self.toJSString(layer.name()),
        density: density,
        format: format,
        path: drawablePath + layer.name() + suffix + "." + format
      });
    }

    return exportable;
  },
  checkSlice: function(layer, layerData, symbolLayer){
    var objectID = ( layerData.type == "symbol" )? this.toJSString(layer.symbolMaster().objectID()):
      ( symbolLayer )? this.toJSString(symbolLayer.objectID()):
      layerData.objectID;
    if(
        (
         layerData.type == "slice" ||
         (
          layerData.type == "symbol" &&
          this.hasExportSizes(layer.symbolMaster())
         )
        ) &&
        !this.sliceCache[objectID]
      ){
      var sliceLayer = ( layerData.type == "symbol" )? layer.symbolMaster(): layer;
      if(symbolLayer && this.is(symbolLayer.parentGroup(), MSSymbolMaster)){
        layer.exportOptions().setLayerOptions(2);
      }

      this.assetsPath = this.savePath + "/assets";
      NSFileManager
        .defaultManager()
        .createDirectoryAtPath_withIntermediateDirectories_attributes_error(this.assetsPath, true, nil, nil);

      this.sliceCache[objectID] = layerData.exportable = this.getExportable(sliceLayer);
      this.slices.push({
        name: layerData.name,
        objectID: objectID,
        rect: layerData.rect,
        exportable: layerData.exportable
      })
    }
    else if( this.sliceCache[objectID] ){
      layerData.exportable = this.sliceCache[objectID];
    }
  },
  checkSymbol: function(artboard, layer, layerData, data){
    if( layerData.type == "symbol" ){
      var self = this,
        symbolObjectID = this.toJSString(layer.symbolMaster().objectID());

      layerData.objectID = symbolObjectID;

      if( !self.hasExportSizes(layer.symbolMaster()) && layer.symbolMaster().children().count() > 1 ){
        var symbolRect = this.getRect(layer),
          symbolChildren = layer.symbolMaster().children(),
          tempSymbol = layer.duplicate(),
          tempGroup = tempSymbol.detachByReplacingWithGroup(),
          tempGroupRect = this.getRect(tempGroup),
          tempSymbolLayers = tempGroup.children().objectEnumerator(),
          idx = 0;

        var tempArtboard = this.addShape();
        tempGroup.addLayers([tempArtboard]);
        var tempArtboardRect = this.getRect(tempArtboard),
        symbolMasterFrame = layer.symbolMaster().frame();

        tempArtboardRect.setX(symbolRect.x);
        tempArtboardRect.setY(symbolRect.y);
        tempArtboardRect.setWidth(symbolMasterFrame.width());
        tempArtboardRect.setHeight(symbolMasterFrame.height());

        tempGroup.resizeToFitChildrenWithOption(0);
        tempGroupRect.setX(symbolRect.x);
        tempGroupRect.setY(symbolRect.y);
        tempGroupRect.setWidth(symbolRect.width);
        tempGroupRect.setHeight(symbolRect.height);
        this.removeLayer(tempArtboard);

        while(tempSymbolLayer = tempSymbolLayers.nextObject()){
          self.getLayer(
              artboard,
              tempSymbolLayer,
              data,
              symbolChildren[idx]
              );
          idx++
        }
        this.removeLayer(tempGroup);
      }
    }
  },
  getSavePath: function(){
    var filePath = this.document.fileURL()? this.document.fileURL().path().stringByDeletingLastPathComponent(): "~";
    var fileName = this.document.displayName().stringByDeletingPathExtension();
    var savePanel = NSSavePanel.savePanel();

    savePanel.setTitle(_("Export spec"));
    savePanel.setNameFieldLabel(_("Export to:"));
    savePanel.setPrompt(_("Export"));
    savePanel.setCanCreateDirectories(true);
    savePanel.setNameFieldStringValue(fileName);

    if (savePanel.runModal() != NSOKButton) {
      return false;
    }

    return savePanel.URL().path();
  },
  exportPanel: function(){
    var self = this;
    this.artboardsData = [];
    this.selectionArtboards = {};
    var data = {};
    data.selection = [];
    data.current = [];
    data.pages = [];

    data.exportOption = self.configs.exportOption;
    if(data.exportOption == undefined){
      data.exportOption = true;
    }

    if(this.selection.count() > 0){
      var selectionArtboards = this.find({key: "(class != NULL) && (class == %@)", match: MSArtboardGroup}, this.selection, true);
      if(selectionArtboards.count() > 0){
        selectionArtboards = selectionArtboards.objectEnumerator();
        while(artboard = selectionArtboards.nextObject()){
          data.selection.push(this.toJSString(artboard.objectID()));
        }
      }
    }
    if(this.artboard) data.current.push(this.toJSString(this.artboard.objectID()));

    var pages = this.document.pages().objectEnumerator();
    while(page = pages.nextObject()){
      var pageData = {},
        artboards = page.artboards().objectEnumerator();
      pageData.name = this.toJSString(page.name());
      pageData.objectID = this.toJSString(page.objectID());
      pageData.artboards = [];

      while(artboard = artboards.nextObject()){
        if(!this.is(artboard, MSSymbolMaster)){
          var artboardData = {};
          artboardData.name = this.toJSString(artboard.name());
          artboardData.objectID = this.toJSString(artboard.objectID());
          pageData.artboards.push(artboardData);
          self.artboardsData.push(artboard);
        }
      }
      pageData.artboards.sort(function(a, b) {
        var nameA = a.name.toUpperCase(),
        nameB = b.name.toUpperCase();
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }
        return 0;
      });
      data.pages.push(pageData);
    }
    return this.SMPanel({
      url: this.pluginSketch + "/panel/export.html",
      width: 440,
      height: 567,
      data: data,
      callback: function( data ){
        self.selectionArtboards = [];
        self.allCount = 0;
        for (var i = 0; i < self.artboardsData.length; i++) {
          var artboard = self.artboardsData[i],
            objectID = self.toJSString( artboard.objectID() );

          if(data[objectID]){
            self.allCount += artboard.children().count();
            self.selectionArtboards.push(artboard);
          }
        }

        self.configs = self.setConfigs({
          exportOption: data.exportOption
        });
      }
    });
  },
  export: function(){
    if(this.exportPanel()){
      if(this.selectionArtboards.length <= 0){
        return false;
      }
      var self = this,
      savePath = this.getSavePath();

      if(savePath){
        // self.message(_("Exporting..."));
        var processingPanel = this.SMPanel({
          url: this.pluginSketch + "/panel/processing.html",
          width: 304,
          height: 104,
          floatWindow: true
        }),
        processing = processingPanel.windowScriptObject(),
        template = NSString.stringWithContentsOfFile_encoding_error(this.pluginSketch + "/template.html", NSUTF8StringEncoding, nil);

        this.savePath = savePath;
        var idx = 1,
        artboardIndex = 0,
        layerIndex = 0,
        exporting = false,
        data = {
          scale: self.configs.scale,
          unit: self.configs.unit,
          colorFormat: self.configs.colorFormat,
          artboards: [],
          slices: [],
          colors: []
        };

        self.single = false;
        self.wantsStop = false;

        coscript.scheduleWithRepeatingInterval_jsFunction( 0, function( interval ){
          // self.message('Processing layer ' + idx + ' of ' + self.allCount);
          processing.evaluateWebScript("processing('"  + Math.round( idx / self.allCount * 100 ) +  "%', '" + _("Processing layer %@ of %@", [idx, self.allCount]) + "')");
          idx++;

          if(!data.artboards[artboardIndex]){
            data.artboards.push({layers: [], notes: []});
            self.maskCache = [];
            self.maskObjectID = undefined;
            self.maskRect = undefined;
          }

          if(!exporting) {
            exporting = true;
            var artboard = self.selectionArtboards[artboardIndex],
            page = artboard.parentGroup(),
            layer = artboard.children()[layerIndex];

            // log( page.name() + ' - ' + artboard.name() + ' - ' + layer.name());
            self.getLayer(
                artboard, // Sketch artboard element
                layer, // Sketch layer element
                data.artboards[artboardIndex] // Save to data
                );


            layerIndex++;
            exporting = false;

            if( self.is(layer, MSArtboardGroup) ){
              var objectID = artboard.objectID(),
                artboardRect = self.getRect(artboard),
                page = artboard.parentGroup(),
                // name = self.toSlug(self.toHTMLEncode(page.name()) + ' ' + self.toHTMLEncode(artboard.name()));
                slug = self.toSlug(page.name() + ' ' + artboard.name());

              data.artboards[artboardIndex].pageName = self.toHTMLEncode(page.name());
              data.artboards[artboardIndex].pageObjectID = self.toJSString(page.objectID());
              data.artboards[artboardIndex].name = self.toHTMLEncode(artboard.name());
              data.artboards[artboardIndex].slug = slug;
              data.artboards[artboardIndex].objectID = self.toJSString(artboard.objectID());
              data.artboards[artboardIndex].width = artboardRect.width;
              data.artboards[artboardIndex].height = artboardRect.height;


              if(!self.configs.exportOption){
                var imageURL = NSURL.fileURLWithPath(self.exportImage({
                  layer: artboard,
                  scale: 2,
                  name: objectID
                })),
                  imageData = NSData.dataWithContentsOfURL(imageURL),
                  imageBase64 = imageData.base64EncodedStringWithOptions(0);
                data.artboards[artboardIndex].imageBase64 = 'data:image/png;base64,' + imageBase64;
                var newData =  JSON.parse(JSON.stringify(data));
                newData.artboards = [data.artboards[artboardIndex]];
                self.writeFile({
                  content: self.template(template, {lang: language, data: JSON.stringify(newData).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}),
                  path: self.toJSString(savePath),
                  fileName: slug + ".html"
                });
              }
              else{
                // data.artboards[artboardIndex].imagePath = "preview/" + objectID + ".png";
                data.artboards[artboardIndex].imagePath = "preview/" + encodeURI(slug) + ".png";

                self.exportImage({
                  layer: artboard,
                  path: self.toJSString(savePath) + "/preview",
                  scale: 2,
                  // name: objectID,
                  name: slug
                });

                self.writeFile({
                  content: "<meta http-equiv=\"refresh\" content=\"0;url=../index.html#artboard" + artboardIndex + "\">",
                  path: self.toJSString(savePath) + "/links",
                  fileName: slug + ".html"
                });
              }


              layerIndex = 0;
              artboardIndex++;
            }

            if(artboardIndex >= self.selectionArtboards.length){
              if(self.slices.length > 0){
                data.slices = self.slices;
              }

              if(self.configs.colors && self.configs.colors.length > 0){
                data.colors = self.configs.colors;
                self.writeFile({
                  content: JSON.stringify(self.configs.colors),
                  path: self.toJSString(savePath),
                  fileName: "colors.json"
                });
              }

              var selectingPath = savePath;
              if(self.configs.exportOption){
                data.artboards.sort(function(a, b) {
                  var slugA = a.slug.toUpperCase(),
                  slugB = b.slug.toUpperCase();
                  if (slugA < slugB) {
                    return -1;
                  }
                  if (slugA > slugB) {
                    return 1;
                  }
                  return 0;
                });

                self.writeFile({
                  content: self.template(template, {lang: language, data: JSON.stringify(data).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}),
                  path: self.toJSString(savePath),
                  fileName: "index.html"
                });
                selectingPath = savePath + "/index.html";
              }
              NSWorkspace.sharedWorkspace().activateFileViewerSelectingURLs(NSArray.arrayWithObjects(NSURL.fileURLWithPath(selectingPath)));

              self.message(_("Export complete!"));
              self.wantsStop = true;
            }
          }

          if( self.wantsStop === true ){
            coscript.setShouldKeepAround(false);
            return interval.cancel();
          }


        });
      }
    }
  },
  writeFile: function(options) {
    var options = this.extend(options, {
      content: "Type something!",
      path: this.toJSString(NSTemporaryDirectory()),
      fileName: "temp.txt"
    }),
    content = NSString.stringWithString(options.content),
    savePathName = [];

    NSFileManager
      .defaultManager()
      .createDirectoryAtPath_withIntermediateDirectories_attributes_error(options.path, true, nil, nil);

    savePathName.push(
        options.path,
        "/",
        options.fileName
        );
    savePathName = savePathName.join("");

    content.writeToFile_atomically_encoding_error(savePathName, false, NSUTF8StringEncoding, null);
  },
  exportImage: function(options) {
    var options = this.extend(options, {
      layer: this.artboard,
      path: this.toJSString(NSTemporaryDirectory()),
      scale: 1,
      name: "preview",
      suffix: "",
      format: "png"
    }),
    document = this.document,
    slice = MSExportRequest.exportRequestsFromExportableLayer(options.layer).firstObject(),
    savePathName = [];

    slice.scale = options.scale;
    slice.format = options.format;

    savePathName.push(
        options.path,
        "/",
        options.name,
        options.suffix,
        ".",
        options.format
        );
    savePathName = savePathName.join("");

    document.saveArtboardOrSlice_toFile(slice, savePathName);

    return savePathName;
  },
  getLayer: function(artboard, layer, data, symbolLayer){
    var artboardRect = artboard.absoluteRect(),
    group = layer.parentGroup(),
    layerStates = this.getStates(layer);

    if(layer && this.is(layer, MSLayerGroup) && /NOTE\#/.exec(layer.name())){
      var textLayer = layer.children()[2];

      data.notes.push({
        rect: this.rectToJSON(textLayer.absoluteRect(), artboardRect),
        note: this.toHTMLEncode(textLayer.stringValue()).replace(/\n/g, "<br>")
      });

      layer.setIsVisible(false);
    }

    if (
        !this.isExportable(layer) ||
        !layerStates.isVisible ||
        ( layerStates.isLocked && !this.is(layer, MSSliceLayer) ) ||
        layerStates.isEmpty ||
        layerStates.hasSlice ||
        layerStates.isMeasure
       ){
      return this;
    }

    var layerType = this.is(layer, MSTextLayer) ? "text" :
      this.is(layer, MSSymbolInstance) ? "symbol" :
      this.is(layer, MSSliceLayer) || this.hasExportSizes(layer)? "slice":
      "shape",
    layerData = {
      objectID: this.toJSString( layer.objectID() ),
      type: layerType,
      name: this.toHTMLEncode(layer.name()),
      rect: this.rectToJSON(layer.absoluteRect(), artboardRect)
    };

    if(symbolLayer) layerData.objectID = this.toJSString( symbolLayer.objectID() )

      if ( ! ( layerType == "slice" || layerType == "symbol" ) ) {
        var layerStyle = layer.style();
        layerData.rotation = layer.rotation();
        layerData.radius = this.getRadius(layer);
        layerData.borders = this.getBorders(layerStyle);
        layerData.fills = this.getFills(layerStyle);
        layerData.shadows = this.getShadows(layerStyle);
        layerData.opacity = this.getOpacity(layerStyle);
        layerData.styleName = this.getStyleName(layer);
      }

    if ( layerType == "text" ) {
      layerData.content = this.toHTMLEncode(layer.stringValue());
      layerData.color = this.colorToJSON(layer.textColor());
      layerData.fontSize = layer.fontSize();
      layerData.fontFace = this.toJSString(layer.fontPostscriptName());
      layerData.textAlign = TextAligns[layer.textAlignment()];
      layerData.letterSpacing = this.toJSNumber(layer.characterSpacing());
      layerData.lineHeight = layer.lineHeight();
    }

    var layerCSSAttributes = layer.CSSAttributes(),
    css = [];

    for(var i = 0; i < layerCSSAttributes.count(); i++) {
      var c = layerCSSAttributes[i]
        if(! /\/\*/.exec(c) ) css.push(this.toJSString(c));
    }
    if(css.length > 0) layerData.css = css;

    this.checkMask(group, layer, layerData, layerStates);
    this.checkSlice(layer, layerData, symbolLayer);
    data.layers.push(layerData);
    this.checkSymbol(artboard, layer, layerData, data);
  },
  template: function(content, data) {
    var content = content.replace(new RegExp("\\<\\!\\-\\-\\s([^\\s\\-\\-\\>]+)\\s\\-\\-\\>", "gi"), function($0, $1) {
      if ($1 in data) {
        return data[$1];
      } else {
        return $0;
      }
    });
    return content;
  }
});
