# Karma configuration

module.exports = (config) ->
  config.set
    # base path, that will be used to resolve files and exclude
    basePath: '../'

    # list of files / patterns to load in the browser
    files: [
        'vendor/js/vendor.js'
        'dist/formrenderer.js'

        'test/vendor/js/chai.js'
        'test/vendor/js/sinon.js'
        'test/vendor/js/chai-jquery.js'
        'test/vendor/js/chai-changes.js'
        'test/vendor/js/chai-backbone.js'
        'test/vendor/js/sinon-chai.js'

        'test/support/*.coffee'
        'test/**/*_test.coffee'
      ]

    # web server port
    port: 8080

    # cli runner port
    runnerPort: 9100

    # enable / disable colors in the output (reporters and logs)
    colors: yes

    # level of logging
    # possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_INFO

    # enable / disable watching file and executing tests whenever any file changes
    autoWatch: no

    # Start these browsers, currently available:
    # - Chrome
    # - ChromeCanary
    # - Firefox
    # - Opera
    # - Safari
    # - PhantomJS
    browsers: ['PhantomJS']

    # compile coffee scripts
    preprocessors: '**/*.coffee': 'coffee'

    frameworks: ['mocha']

    plugins: [
      'karma-mocha'
      'karma-coffee-preprocessor'
      'karma-phantomjs-launcher'
        # 'karma-chrome-launcher'
        # 'karma-firefox-launcher'
        # 'karma-safari-launcher'
      ]
