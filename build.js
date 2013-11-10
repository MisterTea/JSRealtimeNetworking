var fs = require("fs");
var browserify = require('browserify'),
  shim = require('browserify-shim');

shim(browserify(), {
  "angular": {
    path: './public/js/bower_components/angular/angular.js',
    exports: 'angular'
  },
  "angularcookies": {
    path: './public/js/bower_components/angular-cookies/angular-cookies.js',
    exports: 'angular',
    depends: {
      "angular": "angular"
    }
  },
  "fabric": {
    path: './public/js/lib/fabric/fabric_nonode.js',
    exports: 'fabric'
  },
  "ntpclient": {
    path: './public/js/lib/socket-ntp/client/ntp.js',
    exports: 'ntp'
  },
})
  .require(require.resolve('./public/js/main.js'), {
    entry: true
  })
  .bundle({}, function(err, src) {
    if (err) return console.error(err);
    fs.writeFileSync("./public/js/bundle.js", src);
  });
