(function() {
  var inputEvent;

  inputEvent = document.addEventListener ? 'input' : 'keyup';

  rivets.binders.input = {
    publishes: true,
    routine: rivets.binders.value.routine,
    bind: function(el) {
      return $(el).bind("" + inputEvent + ".rivets", this.publish);
    },
    unbind: function(el) {
      return $(el).unbind("" + inputEvent + ".rivets");
    }
  };

  rivets.formatters.prepend = function(value, x) {
    return "" + x + value;
  };

  rivets.configure({
    prefix: "rv",
    adapter: {
      subscribe: function(obj, keypath, callback) {
        callback.wrapped = function(m, v) {
          return callback(v);
        };
        return obj.on('change:' + keypath, callback.wrapped);
      },
      unsubscribe: function(obj, keypath, callback) {
        return obj.off('change:' + keypath, callback.wrapped);
      },
      read: function(obj, keypath) {
        if (keypath === "cid") {
          return obj.cid;
        }
        return obj.get(keypath);
      },
      publish: function(obj, keypath, value) {
        if (obj.cid) {
          return obj.set(keypath, value);
        } else {
          return obj[keypath] = value;
        }
      }
    }
  });

}).call(this);

(function() {
  var FormRenderer;

  window.FormRenderer = FormRenderer = Backbone.View.extend({
    defaults: {
      enableAutosave: true,
      enableBeforeUnload: true,
      enablePages: true,
      enableErrorAlertBar: true,
      enableBottomStatusBar: true,
      enableLocalstorage: true,
      screendoorBase: 'https://screendoor.dobt.co',
      target: '[data-formrenderer]',
      validateImmediately: false,
      ignoreUser: void 0,
      editInPlace: void 0,
      response: {},
      preview: false,
      skipValidation: void 0
    },
    events: {
      'click [data-activate-page]': function(e) {
        return this.activatePage($(e.currentTarget).data('activate-page'), {
          skipValidation: true
        });
      }
    },
    draftIdStorageKey: function() {
      return "project-" + this.options.project_id + "-response-id";
    },
    constructor: function(options) {
      this.options = $.extend({}, this.defaults, options);
      this.state = new Backbone.Model({
        hasChanges: false
      });
      this.setElement($(this.options.target));
      this.$el.addClass('fr_form');
      this.$el.data('form-renderer', this);
      this.subviews = {
        pages: {}
      };
      this.$el.html(JST['main'](this));
      if (this.options.enableLocalstorage) {
        this.initLocalstorage();
      }
      return this.loadFromServer((function(_this) {
        return function() {
          _this.$el.find('.fr_loading').remove();
          _this.constructResponseFields();
          _this.constructPages();
          if (_this.options.enablePages) {
            _this.constructPagination();
          } else {
            _this.disablePagination();
          }
          if (_this.options.enableBottomStatusBar) {
            _this.constructBottomStatusBar();
          }
          if (_this.options.enableErrorAlertBar) {
            _this.constructErrorAlertBar();
          }
          if (_this.options.enableAutosave) {
            _this.initAutosave();
          }
          if (_this.options.enableBeforeUnload) {
            _this.initBeforeUnload();
          }
          if (_this.options.validateImmediately) {
            return _this.validateAllPages();
          }
        };
      })(this));
    },
    initLocalstorage: function() {
      var _base;
      (_base = this.options.response).id || (_base.id = store.get(this.draftIdStorageKey()));
      return this.listenTo(this, 'afterSave', function() {
        if (!this.state.get('submitting')) {
          return store.set(this.draftIdStorageKey(), this.options.response.id);
        }
      });
    },
    loadFromServer: function(cb) {
      if ((this.options.response_fields != null) && (this.options.response.responses != null)) {
        return cb();
      }
      return $.ajax({
        url: "" + this.options.screendoorBase + "/api/form_renderer/load",
        type: 'get',
        dataType: 'json',
        data: {
          project_id: this.options.project_id,
          response_id: this.options.response.id,
          v: 0
        },
        success: (function(_this) {
          return function(data) {
            var _base, _base1, _ref;
            _this.options.response.id = data.response_id;
            (_base = _this.options).response_fields || (_base.response_fields = data.project.response_fields);
            (_base1 = _this.options.response).responses || (_base1.responses = ((_ref = data.response) != null ? _ref.responses : void 0) || {});
            return cb();
          };
        })(this),
        error: (function(_this) {
          return function() {
            return store.remove(_this.draftIdStorageKey());
          };
        })(this)
      });
    },
    constructResponseFields: function() {
      var model, rf, _i, _len, _ref;
      this.response_fields = new Backbone.Collection;
      _ref = this.options.response_fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        rf = _ref[_i];
        model = new FormRenderer.Models["ResponseField" + (_.str.classify(rf.field_type))](rf);
        if (model.input_field) {
          model.setExistingValue(this.options.response.responses[model.get('id')]);
        }
        this.response_fields.add(model);
      }
      return this.listenTo(this.response_fields, 'change', function() {
        if (!this.state.get('hasChanges')) {
          return this.state.set('hasChanges', true);
        }
      });
    },
    validateCurrentPage: function() {
      this.trigger("beforeValidate beforeValidate:" + (this.state.get('activePage')));
      this.subviews.pages[this.state.get('activePage')].validate();
      this.trigger("afterValidate afterValidate:" + (this.state.get('activePage')));
      return this.isPageValid(this.state.get('activePage'));
    },
    validateAllPages: function() {
      var page, pageNumber, _ref;
      this.trigger('beforeValidate beforeValidate:all');
      _ref = this.subviews.pages;
      for (pageNumber in _ref) {
        page = _ref[pageNumber];
        page.validate();
      }
      this.trigger('afterValidate afterValidate:all');
      return this.areAllPagesValid();
    },
    isPageValid: function(pageNumber) {
      return !_.find(this.subviews.pages[pageNumber].models, (function(rf) {
        return rf.input_field && rf.errors.length > 0;
      }));
    },
    areAllPagesValid: function() {
      var _i, _ref, _results;
      return _.every((function() {
        _results = [];
        for (var _i = 1, _ref = this.numPages; 1 <= _ref ? _i <= _ref : _i >= _ref; 1 <= _ref ? _i++ : _i--){ _results.push(_i); }
        return _results;
      }).apply(this), (function(_this) {
        return function(x) {
          return _this.isPageValid(x);
        };
      })(this));
    },
    numValidationErrors: function() {
      return this.response_fields.filter(function(rf) {
        return rf.input_field && rf.errors.length > 0;
      }).length;
    },
    constructPages: function() {
      var addPage, currentPageInLoop, page, pageNumber, _ref, _results;
      addPage = (function(_this) {
        return function() {
          return _this.subviews.pages[currentPageInLoop] = new FormRenderer.Views.Page({
            form_renderer: _this
          });
        };
      })(this);
      this.numPages = this.response_fields.filter(function(rf) {
        return rf.get('field_type') === 'page_break';
      }).length + 1;
      this.state.set('activePage', 1);
      currentPageInLoop = 1;
      addPage();
      this.response_fields.each((function(_this) {
        return function(rf) {
          if (rf.get('field_type') === 'page_break') {
            currentPageInLoop++;
            return addPage();
          } else {
            return _this.subviews.pages[currentPageInLoop].models.push(rf);
          }
        };
      })(this));
      _ref = this.subviews.pages;
      _results = [];
      for (pageNumber in _ref) {
        page = _ref[pageNumber];
        _results.push(this.$el.append(page.render().el));
      }
      return _results;
    },
    constructPagination: function() {
      this.subviews.pagination = new FormRenderer.Views.Pagination({
        form_renderer: this
      });
      this.$el.prepend(this.subviews.pagination.render().el);
      return this.subviews.pages[this.state.get('activePage')].show();
    },
    disablePagination: function() {
      var page, pageNumber, _ref, _results;
      _ref = this.subviews.pages;
      _results = [];
      for (pageNumber in _ref) {
        page = _ref[pageNumber];
        _results.push(page.show());
      }
      return _results;
    },
    constructBottomStatusBar: function() {
      this.subviews.bottomStatusBar = new FormRenderer.Views.BottomStatusBar({
        form_renderer: this
      });
      return this.$el.append(this.subviews.bottomStatusBar.render().el);
    },
    constructErrorAlertBar: function() {
      this.subviews.errorAlertBar = new FormRenderer.Views.ErrorAlertBar({
        form_renderer: this
      });
      return this.$el.prepend(this.subviews.errorAlertBar.render().el);
    },
    activatePage: function(newPageNumber, opts) {
      if (opts == null) {
        opts = {};
      }
      if (!(opts.skipValidation || this.validateCurrentPage())) {
        return;
      }
      this.subviews.pages[this.state.get('activePage')].hide();
      this.subviews.pages[newPageNumber].show();
      return this.state.set('activePage', newPageNumber);
    },
    getValue: function() {
      return _.tap({}, (function(_this) {
        return function(h) {
          return _this.response_fields.each(function(rf) {
            var gotValue;
            if (!rf.input_field) {
              return;
            }
            gotValue = rf.getValue();
            if ((typeof gotValue === 'object') && gotValue.merge) {
              delete gotValue.merge;
              return _.extend(h, gotValue);
            } else {
              return h[rf.get('id')] = gotValue;
            }
          });
        };
      })(this));
    },
    saveParams: function() {
      return {
        v: 0,
        response_id: this.options.response.id,
        project_id: this.options.project_id,
        edit_in_place: this.options.editInPlace,
        ignore_user: this.options.ignoreUser,
        skip_validation: this.options.skipValidation,
        background_submit: true
      };
    },
    save: function(options) {
      if (options == null) {
        options = {};
      }
      this.isSaving = true;
      return $.ajax({
        url: "" + this.options.screendoorBase + "/api/form_renderer/save",
        type: 'post',
        dataType: 'json',
        data: _.extend(this.saveParams(), {
          raw_responses: this.getValue(),
          submit: options.submit ? true : void 0
        }),
        complete: (function(_this) {
          return function() {
            var _ref;
            _this.isSaving = false;
            if ((_ref = options.complete) != null) {
              _ref.apply(_this, arguments);
            }
            return _this.trigger('afterSave');
          };
        })(this),
        success: (function(_this) {
          return function(data) {
            var _ref;
            _this.state.set({
              hasChanges: false,
              hasServerErrors: false
            });
            _this.options.response.id = data.response_id;
            return (_ref = options.success) != null ? _ref.apply(_this, arguments) : void 0;
          };
        })(this),
        error: (function(_this) {
          return function() {
            var _ref;
            _this.state.set({
              hasServerErrors: true,
              submitting: false
            });
            return (_ref = options.error) != null ? _ref.apply(_this, arguments) : void 0;
          };
        })(this)
      });
    },
    initAutosave: function() {
      return setInterval((function(_this) {
        return function() {
          if (_this.state.get('hasChanges') && !_this.isSaving) {
            return _this.save();
          }
        };
      })(this), 5000);
    },
    autosaveImmediately: function() {
      if (this.state.get('hasChanges') && !this.isSaving && this.options.enableAutosave) {
        return this.save();
      }
    },
    initBeforeUnload: function() {
      return BeforeUnload.enable((function(_this) {
        return function() {
          return _this.state.get('hasChanges');
        };
      })(this), 'You have unsaved changes. Are you sure you want to leave this page?');
    },
    submit: function(opts) {
      var afterSubmit;
      if (opts == null) {
        opts = {};
      }
      if (!(opts.skipValidation || this.options.skipValidation || this.validateAllPages())) {
        return;
      }
      this.state.set('submitting', true);
      if (this.options.preview) {
        return this.preview();
      }
      afterSubmit = opts.afterSubmit || this.options.afterSubmit;
      return this.save({
        submit: true,
        success: (function(_this) {
          return function() {
            var $page;
            store.remove(_this.draftIdStorageKey());
            if (typeof afterSubmit === 'function') {
              return afterSubmit.call(_this);
            } else if (typeof afterSubmit === 'string') {
              return window.location = afterSubmit.replace(':id', _this.options.response.id);
            } else if (typeof afterSubmit === 'object' && afterSubmit.method === 'page') {
              $page = $("<div class='fr_after_submit_page'>" + afterSubmit.html + "</div>");
              return _this.$el.replaceWith($page);
            } else {
              return console.log('[FormRenderer] Not sure what to do...');
            }
          };
        })(this)
      });
    },
    preview: function() {
      var cb;
      cb = (function(_this) {
        return function() {
          return window.location = _this.options.preview.replace(':id', _this.options.response.id);
        };
      })(this);
      if (this.state.get('hasChanges') || !this.options.enableAutosave || !this.options.response.id) {
        return this.save({
          success: cb
        });
      } else {
        return cb();
      }
    }
  });

  FormRenderer.INPUT_FIELD_TYPES = ['address', 'checkboxes', 'date', 'dropdown', 'email', 'file', 'number', 'paragraph', 'price', 'radio', 'table', 'text', 'time', 'website', 'map_marker'];

  FormRenderer.NON_INPUT_FIELD_TYPES = ['block_of_text', 'page_break', 'section_break'];

  FormRenderer.FIELD_TYPES = _.union(FormRenderer.INPUT_FIELD_TYPES, FormRenderer.NON_INPUT_FIELD_TYPES);

  FormRenderer.Views = {};

  FormRenderer.Models = {};

  FormRenderer.Validators = {};

  FormRenderer.LEAFLET_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.3/leaflet.js";

  FormRenderer.MAP_TILE_URL = 'https://{s}.tiles.mapbox.com/v3/adamjacobbecker.ja7plkah/{z}/{x}/{y}.png';

  FormRenderer.DEFAULT_LAT_LNG = [40.7700118, -73.9800453];

  FormRenderer.BUTTON_CLASS = '';

}).call(this);

(function() {
  FormRenderer.Validators.BaseValidator = (function() {
    function BaseValidator(model) {
      this.model = model;
    }

    return BaseValidator;

  })();

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.DateValidator = (function(_super) {
    __extends(DateValidator, _super);

    function DateValidator() {
      return DateValidator.__super__.constructor.apply(this, arguments);
    }

    DateValidator.prototype.validate = function() {
      var day, month, year;
      if (this.model.field_type !== 'date') {
        return;
      }
      year = parseInt(this.model.get('value.year'), 10) || 0;
      day = parseInt(this.model.get('value.day'), 10) || 0;
      month = parseInt(this.model.get('value.month'), 10) || 0;
      if (!((year > 0) && ((0 < day && day <= 31)) && ((0 < month && month <= 12)))) {
        return 'not a valid date';
      }
    };

    return DateValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.EmailValidator = (function(_super) {
    __extends(EmailValidator, _super);

    function EmailValidator() {
      return EmailValidator.__super__.constructor.apply(this, arguments);
    }

    EmailValidator.prototype.validate = function() {
      if (this.model.field_type !== 'email') {
        return;
      }
      if (!this.model.get('value').match('@')) {
        return 'not a valid email';
      }
    };

    return EmailValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.IntegerValidator = (function(_super) {
    __extends(IntegerValidator, _super);

    function IntegerValidator() {
      return IntegerValidator.__super__.constructor.apply(this, arguments);
    }

    IntegerValidator.VALID_REGEX = /^-?\d+$/;

    IntegerValidator.prototype.validate = function() {
      if (!this.model.get('field_options.integer_only')) {
        return;
      }
      if (!this.model.get('value').match(this.constructor.VALID_REGEX)) {
        return 'is not an integer';
      }
    };

    return IntegerValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.MinMaxLengthValidator = (function(_super) {
    __extends(MinMaxLengthValidator, _super);

    function MinMaxLengthValidator() {
      return MinMaxLengthValidator.__super__.constructor.apply(this, arguments);
    }

    MinMaxLengthValidator.prototype.validate = function() {
      var count;
      if (!(this.model.get('field_options.minlength') || this.model.get('field_options.maxlength'))) {
        return;
      }
      this.min = parseInt(this.model.get('field_options.minlength'), 10) || void 0;
      this.max = parseInt(this.model.get('field_options.maxlength'), 10) || void 0;
      count = this.model.get('field_options.min_max_length_units') === 'words' ? this.countWords() : this.countCharacters();
      if (this.min && count < this.min) {
        return 'is too short';
      } else if (this.max && count > this.max) {
        return 'is too long';
      }
    };

    MinMaxLengthValidator.prototype.countWords = function() {
      return (_.str.trim(this.model.get('value')).replace(/['";:,.?¿\-!¡]+/g, '').match(/\S+/g) || '').length;
    };

    MinMaxLengthValidator.prototype.countCharacters = function() {
      return _.str.trim(this.model.get('value')).replace(/\s/g, '').length;
    };

    return MinMaxLengthValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.MinMaxValidator = (function(_super) {
    __extends(MinMaxValidator, _super);

    function MinMaxValidator() {
      return MinMaxValidator.__super__.constructor.apply(this, arguments);
    }

    MinMaxValidator.prototype.validate = function() {
      var value;
      if (!(this.model.get('field_options.min') || this.model.get('field_options.max'))) {
        return;
      }
      this.min = this.model.get('field_options.min') && parseFloat(this.model.get('field_options.min'));
      this.max = this.model.get('field_options.max') && parseFloat(this.model.get('field_options.max'));
      value = this.model.field_type === 'price' ? parseFloat("" + (this.model.get('value.dollars') || 0) + "." + (this.model.get('value.cents') || 0)) : parseFloat(this.model.get('value').replace(/,/g, ''));
      if (this.min && value < this.min) {
        return 'is too small';
      } else if (this.max && value > this.max) {
        return 'is too large';
      }
    };

    return MinMaxValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.NumberValidator = (function(_super) {
    __extends(NumberValidator, _super);

    function NumberValidator() {
      return NumberValidator.__super__.constructor.apply(this, arguments);
    }

    NumberValidator.VALID_REGEX = /^-?\d*(\.\d+)?$/;

    NumberValidator.prototype.validate = function() {
      var value;
      if (this.model.field_type !== 'number') {
        return;
      }
      value = this.model.get('value');
      value = value.replace(/,/g, '').replace(/-/g, '').replace(/^\+/, '');
      if (!value.match(this.constructor.VALID_REGEX)) {
        return 'not a valid number';
      }
    };

    return NumberValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.PriceValidator = (function(_super) {
    __extends(PriceValidator, _super);

    function PriceValidator() {
      return PriceValidator.__super__.constructor.apply(this, arguments);
    }

    PriceValidator.prototype.validate = function() {
      var values;
      if (this.model.field_type !== 'price') {
        return;
      }
      values = [];
      if (this.model.get('value.dollars')) {
        values.push(this.model.get('value.dollars').replace(/,/g, ''));
      }
      if (this.model.get('value.cents')) {
        values.push(this.model.get('value.cents'));
      }
      if (!_.every(values, function(x) {
        return x.match(/^-?\d+$/);
      })) {
        return "isn't a valid price";
      }
    };

    return PriceValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  FormRenderer.Validators.TimeValidator = (function(_super) {
    __extends(TimeValidator, _super);

    function TimeValidator() {
      return TimeValidator.__super__.constructor.apply(this, arguments);
    }

    TimeValidator.prototype.validate = function() {
      var hours, minutes, seconds;
      if (this.model.field_type !== 'time') {
        return;
      }
      hours = parseInt(this.model.get('value.hours'), 10) || 0;
      minutes = parseInt(this.model.get('value.minutes'), 10) || 0;
      seconds = parseInt(this.model.get('value.seconds'), 10) || 0;
      if (!(((1 <= hours && hours <= 12)) && ((0 <= minutes && minutes <= 60)) && ((0 <= seconds && seconds <= 60)))) {
        return "isn't a valid time";
      }
    };

    return TimeValidator;

  })(FormRenderer.Validators.BaseValidator);

}).call(this);

(function() {
  var i, _i, _len, _ref;

  FormRenderer.Models.ResponseField = Backbone.DeepModel.extend({
    input_field: true,
    field_type: void 0,
    validators: [],
    sync: function() {},
    initialize: function() {
      this.errors = [];
      if (this.hasLengthValidations()) {
        return this.listenTo(this, 'change:value', this.calculateLength);
      }
    },
    validate: function() {
      var newError, v, validator, validatorName, _ref, _results;
      this.errors = [];
      if (!this.hasValue()) {
        if (this.get('required')) {
          this.errors.push("can't be blank");
        }
        return;
      }
      _ref = this.validators;
      _results = [];
      for (validatorName in _ref) {
        validator = _ref[validatorName];
        v = new validator(this);
        newError = v.validate();
        if (newError) {
          _results.push(this.errors.push(newError));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    },
    getError: function() {
      if (this.errors.length > 0) {
        return this.errors.join('. ');
      }
    },
    hasLengthValidations: function() {
      return this.get('field_options.minlength') || this.get('field_options.maxlength');
    },
    calculateLength: function() {
      var v;
      v = new FormRenderer.Validators.MinMaxLengthValidator(this);
      return this.set('currentLength', v[this.getLengthValidationUnits() === 'words' ? 'countWords' : 'countCharacters']());
    },
    hasMinMaxValidations: function() {
      return this.get('field_options.min') || this.get('field_options.max');
    },
    getLengthValidationUnits: function() {
      return this.get('field_options.min_max_length_units') || 'characters';
    },
    setExistingValue: function(x) {
      if (x) {
        this.set('value', x);
      }
      if (this.hasLengthValidations()) {
        return this.calculateLength();
      }
    },
    getValue: function() {
      return this.get('value');
    },
    hasValue: function() {
      return !!this.get('value');
    },
    hasAnyValueInHash: function() {
      return _.some(this.get('value'), function(v, k) {
        return !!v;
      });
    },
    hasValueHashKey: function(keys) {
      return _.some(keys, (function(_this) {
        return function(key) {
          return !!_this.get("value." + key);
        };
      })(this));
    },
    getOptions: function() {
      return this.get('field_options.options') || [];
    },
    getColumns: function() {
      return this.get('field_options.columns') || [];
    },
    columnOrOptionKeypath: function() {
      if (this.field_type === 'table') {
        return 'field_options.columns';
      } else {
        return 'field_options.options';
      }
    },
    addOptionOrColumnAtIndex: function(i) {
      var newOpt, opts;
      opts = this.field_type === 'table' ? this.getColumns() : this.getOptions();
      newOpt = {
        label: ''
      };
      if (this.field_type !== 'table') {
        newOpt['checked'] = false;
      }
      if (i === -1) {
        opts.push(newOpt);
      } else {
        opts.splice(i + 1, 0, newOpt);
      }
      this.set(this.columnOrOptionKeypath(), opts);
      return this.trigger('change');
    },
    removeOptionOrColumnAtIndex: function(i) {
      var opts;
      opts = this.get(this.columnOrOptionKeypath());
      opts.splice(i, 1);
      this.set(this.columnOrOptionKeypath(), opts);
      return this.trigger('change');
    }
  });

  FormRenderer.Models.NonInputResponseField = Backbone.DeepModel.extend({
    input_field: false,
    field_type: void 0,
    sync: function() {}
  });

  FormRenderer.Models.ResponseFieldMapMarker = FormRenderer.Models.ResponseField.extend({
    field_type: 'map_marker',
    hasValue: function() {
      return _.every(['lat', 'lng'], (function(_this) {
        return function(key) {
          return !!_this.get("value." + key);
        };
      })(this));
    },
    latLng: function() {
      if (this.hasValue()) {
        return [this.get('value.lat'), this.get('value.lng')];
      }
    },
    defaultLatLng: function() {
      var lat, lng;
      if ((lat = this.get('field_options.default_lat')) && (lng = this.get('field_options.default_lng'))) {
        return [lat, lng];
      }
    }
  });

  FormRenderer.Models.ResponseFieldAddress = FormRenderer.Models.ResponseField.extend({
    field_type: 'address',
    setExistingValue: function(x) {
      FormRenderer.Models.ResponseField.prototype.setExistingValue.apply(this, arguments);
      if (!(x != null ? x.country : void 0)) {
        return this.set('value.country', 'US');
      }
    },
    hasValue: function() {
      return this.hasValueHashKey(['street', 'city', 'state', 'zipcode']);
    }
  });

  FormRenderer.Models.ResponseFieldCheckboxes = FormRenderer.Models.ResponseField.extend({
    field_type: 'checkboxes',
    setExistingValue: function(x) {
      return this.set('value', _.tap({}, (function(_this) {
        return function(h) {
          var i, option, _i, _j, _len, _len1, _ref, _ref1, _results;
          if (!_.isEmpty(x)) {
            _ref = _this.getOptions();
            for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
              option = _ref[i];
              h["" + i] = x[option.label];
            }
            if (x.Other) {
              h['other_checkbox'] = true;
              return h['other'] = x.Other;
            }
          } else {
            _ref1 = _this.getOptions();
            _results = [];
            for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
              option = _ref1[i];
              _results.push(h["" + i] = _.toBoolean(option.checked));
            }
            return _results;
          }
        };
      })(this)));
    },
    getValue: function() {
      var k, returnValue, v, _ref;
      returnValue = {};
      _ref = this.get('value');
      for (k in _ref) {
        v = _ref[k];
        returnValue[k] = v === true ? 'on' : v;
      }
      return returnValue;
    },
    hasValue: function() {
      return this.hasAnyValueInHash();
    }
  });

  FormRenderer.Models.ResponseFieldRadio = FormRenderer.Models.ResponseField.extend({
    field_type: 'radio',
    setExistingValue: function(x) {
      var defaultOption;
      if (x != null ? x.selected : void 0) {
        return this.set('value', x);
      } else if ((defaultOption = _.find(this.getOptions(), (function(option) {
        return _.toBoolean(option.checked);
      })))) {
        return this.set('value.selected', defaultOption.label);
      } else {
        return this.set('value', {});
      }
    },
    getValue: function() {
      return _.tap({
        merge: true
      }, (function(_this) {
        return function(h) {
          h["" + (_this.get('id'))] = _this.get('value.selected');
          return h["" + (_this.get('id')) + "_other"] = _this.get('value.other');
        };
      })(this));
    },
    hasValue: function() {
      return !!this.get('value.selected');
    }
  });

  FormRenderer.Models.ResponseFieldDropdown = FormRenderer.Models.ResponseField.extend({
    field_type: 'dropdown',
    setExistingValue: function(x) {
      var checkedOption;
      if (x != null) {
        return FormRenderer.Models.ResponseField.prototype.setExistingValue.apply(this, arguments);
      } else {
        checkedOption = _.find(this.getOptions(), (function(option) {
          return _.toBoolean(option.checked);
        }));
        if (!checkedOption && !this.get('field_options.include_blank_option')) {
          checkedOption = _.first(this.getOptions());
        }
        if (checkedOption) {
          return this.set('value', checkedOption.label);
        } else {
          return this.unset('value');
        }
      }
    }
  });

  FormRenderer.Models.ResponseFieldTable = FormRenderer.Models.ResponseField.extend({
    field_type: 'table',
    initialize: function() {
      FormRenderer.Models.ResponseField.prototype.initialize.apply(this, arguments);
      if (this.get('field_options.column_totals')) {
        return this.listenTo(this, 'change:value.*', this.calculateColumnTotals);
      }
    },
    setExistingValue: function(x) {
      var firstColumnLength, minRows, _ref;
      firstColumnLength = ((_ref = _.find(x, (function() {
        return true;
      }))) != null ? _ref.length : void 0) || 0;
      minRows = parseInt(this.get('field_options.minrows'), 10) || 0;
      this.numRows = Math.max(minRows, firstColumnLength, 1);
      return this.set('value', _.tap({}, (function(_this) {
        return function(h) {
          var column, i, j, _i, _ref1, _results;
          _results = [];
          for (i = _i = 0, _ref1 = _this.numRows - 1; 0 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
            _results.push((function() {
              var _j, _len, _name, _ref2, _ref3, _results1;
              _ref2 = this.getColumns();
              _results1 = [];
              for (j = _j = 0, _len = _ref2.length; _j < _len; j = ++_j) {
                column = _ref2[j];
                h[_name = "" + j] || (h[_name] = {});
                _results1.push(h["" + j]["" + i] = this.getPresetValue(column.label, i) || (x != null ? (_ref3 = x[column.label]) != null ? _ref3[i] : void 0 : void 0));
              }
              return _results1;
            }).call(_this));
          }
          return _results;
        };
      })(this)));
    },
    hasValue: function() {
      return _.some(this.get('value'), function(colVals, colNumber) {
        return _.some(colVals, function(v, k) {
          return !!v;
        });
      });
    },
    getPresetValue: function(columnLabel, rowIndex) {
      var _ref;
      return (_ref = this.get("field_options.preset_values." + columnLabel)) != null ? _ref[rowIndex] : void 0;
    },
    getValue: function() {
      var column, i, j, returnValue, _i, _j, _len, _ref, _ref1;
      returnValue = {};
      for (i = _i = 0, _ref = this.numRows - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        _ref1 = this.getColumns();
        for (j = _j = 0, _len = _ref1.length; _j < _len; j = ++_j) {
          column = _ref1[j];
          returnValue[j] || (returnValue[j] = []);
          returnValue[j].push(this.get("value." + j + "." + i) || '');
        }
      }
      return returnValue;
    },
    calculateColumnTotals: function() {
      var column, columnSum, columnVals, i, j, _i, _j, _len, _ref, _ref1, _results;
      _ref = this.getColumns();
      _results = [];
      for (j = _i = 0, _len = _ref.length; _i < _len; j = ++_i) {
        column = _ref[j];
        columnVals = [];
        for (i = _j = 0, _ref1 = this.numRows - 1; 0 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          columnVals.push(parseFloat((this.get("value." + j + "." + i) || '').replace(/\$?,?/g, '')));
        }
        columnSum = _.reduce(columnVals, function(memo, num) {
          if (_.isNaN(num)) {
            return memo;
          } else {
            return memo + num;
          }
        }, 0);
        _results.push(this.set("columnTotals." + j, columnSum > 0 ? parseFloat(columnSum.toFixed(10)) : ''));
      }
      return _results;
    }
  });

  FormRenderer.Models.ResponseFieldFile = FormRenderer.Models.ResponseField.extend({
    field_type: 'file',
    getValue: function() {
      return this.get('value.id') || '';
    },
    hasValue: function() {
      return this.hasValueHashKey(['id']);
    }
  });

  FormRenderer.Models.ResponseFieldDate = FormRenderer.Models.ResponseField.extend({
    field_type: 'date',
    validators: [FormRenderer.Validators.DateValidator],
    hasValue: function() {
      return this.hasValueHashKey(['month', 'day', 'year']);
    }
  });

  FormRenderer.Models.ResponseFieldEmail = FormRenderer.Models.ResponseField.extend({
    validators: [FormRenderer.Validators.EmailValidator],
    field_type: 'email'
  });

  FormRenderer.Models.ResponseFieldNumber = FormRenderer.Models.ResponseField.extend({
    validators: [FormRenderer.Validators.NumberValidator, FormRenderer.Validators.MinMaxValidator, FormRenderer.Validators.IntegerValidator],
    field_type: 'number'
  });

  FormRenderer.Models.ResponseFieldParagraph = FormRenderer.Models.ResponseField.extend({
    field_type: 'paragraph',
    validators: [FormRenderer.Validators.MinMaxLengthValidator]
  });

  FormRenderer.Models.ResponseFieldPrice = FormRenderer.Models.ResponseField.extend({
    validators: [FormRenderer.Validators.PriceValidator, FormRenderer.Validators.MinMaxValidator],
    field_type: 'price',
    hasValue: function() {
      return this.hasValueHashKey(['dollars', 'cents']);
    }
  });

  FormRenderer.Models.ResponseFieldText = FormRenderer.Models.ResponseField.extend({
    field_type: 'text',
    validators: [FormRenderer.Validators.MinMaxLengthValidator]
  });

  FormRenderer.Models.ResponseFieldTime = FormRenderer.Models.ResponseField.extend({
    validators: [FormRenderer.Validators.TimeValidator],
    field_type: 'time',
    hasValue: function() {
      return this.hasValueHashKey(['hours', 'minutes', 'seconds']);
    },
    setExistingValue: function(x) {
      FormRenderer.Models.ResponseField.prototype.setExistingValue.apply(this, arguments);
      if (!(x != null ? x.am_pm : void 0)) {
        return this.set('value.am_pm', 'AM');
      }
    }
  });

  FormRenderer.Models.ResponseFieldWebsite = FormRenderer.Models.ResponseField.extend({
    field_type: 'website'
  });

  _ref = FormRenderer.NON_INPUT_FIELD_TYPES;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    i = _ref[_i];
    FormRenderer.Models["ResponseField" + (_.str.classify(i))] = FormRenderer.Models.NonInputResponseField.extend({
      field_type: i
    });
  }

}).call(this);

(function() {
  var i, _i, _j, _len, _len1, _ref, _ref1;

  FormRenderer.Views.Pagination = Backbone.View.extend({
    initialize: function(options) {
      this.form_renderer = options.form_renderer;
      this.listenTo(this.form_renderer.state, 'change:activePage', this.render);
      return this.listenTo(this.form_renderer, 'afterValidate', this.render);
    },
    render: function() {
      this.$el.html(JST['partials/pagination'](this));
      return this;
    }
  });

  FormRenderer.Views.ErrorAlertBar = Backbone.View.extend({
    initialize: function(options) {
      this.form_renderer = options.form_renderer;
      return this.listenTo(this.form_renderer, 'afterValidate', this.render);
    },
    render: function() {
      this.$el.html(JST['partials/error_alert_bar'](this));
      if (!this.form_renderer.areAllPagesValid()) {
        window.scrollTo(0, 0);
      }
      return this;
    }
  });

  FormRenderer.Views.BottomStatusBar = Backbone.View.extend({
    events: {
      'click [data-js-back]': 'handleBack',
      'click [data-js-continue]': 'handleContinue'
    },
    initialize: function(options) {
      this.form_renderer = options.form_renderer;
      return this.listenTo(this.form_renderer.state, 'change:activePage change:hasChanges change:submitting change:hasServerErrors', this.render);
    },
    render: function() {
      this.$el.html(JST['partials/bottom_status_bar'](this));
      return this;
    },
    firstPage: function() {
      return this.form_renderer.state.get('activePage') === 1;
    },
    lastPage: function() {
      return this.form_renderer.state.get('activePage') === this.form_renderer.numPages;
    },
    previousPage: function() {
      return this.form_renderer.state.get('activePage') - 1;
    },
    nextPage: function() {
      return this.form_renderer.state.get('activePage') + 1;
    },
    handleBack: function(e) {
      e.preventDefault();
      return this.form_renderer.activatePage(this.previousPage(), {
        skipValidation: true
      });
    },
    handleContinue: function(e) {
      e.preventDefault();
      if (this.lastPage() || !this.form_renderer.options.enablePages) {
        return this.form_renderer.submit();
      } else {
        return this.form_renderer.activatePage(this.nextPage());
      }
    }
  });

  FormRenderer.Views.Page = Backbone.View.extend({
    className: 'fr_page',
    initialize: function(options) {
      this.form_renderer = options.form_renderer;
      this.models = [];
      return this.views = [];
    },
    render: function() {
      var rf, view, _i, _len, _ref;
      this.hide();
      _ref = this.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        rf = _ref[_i];
        view = new FormRenderer.Views["ResponseField" + (_.str.classify(rf.field_type))]({
          model: rf,
          form_renderer: this.form_renderer
        });
        this.$el.append(view.render().el);
        this.views.push(view);
      }
      return this;
    },
    hide: function() {
      var view, _i, _len, _ref, _results;
      this.$el.hide();
      _ref = this.views;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        view = _ref[_i];
        _results.push(view.trigger('hidden'));
      }
      return _results;
    },
    show: function() {
      var view, _i, _len, _ref, _results;
      this.$el.show();
      _ref = this.views;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        view = _ref[_i];
        _results.push(view.trigger('shown'));
      }
      return _results;
    },
    validate: function() {
      var rf, view, _i, _j, _len, _len1, _ref, _ref1, _results;
      _ref = _.filter(this.models, (function(rf) {
        return rf.input_field;
      }));
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        rf = _ref[_i];
        rf.validate();
      }
      _ref1 = this.views;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        view = _ref1[_j];
        _results.push(view.render());
      }
      return _results;
    }
  });

  FormRenderer.Views.ResponseField = Backbone.View.extend({
    field_type: void 0,
    className: 'fr_response_field',
    initialize: function(options) {
      this.form_renderer = options.form_renderer;
      this.model = options.model;
      return this.$el.addClass("fr_response_field_" + this.field_type);
    },
    getDomId: function() {
      return this.model.cid;
    },
    render: function() {
      this.$el[this.model.getError() ? 'addClass' : 'removeClass']('error');
      this.$el.html(JST['partials/response_field'](this));
      rivets.bind(this.$el, {
        model: this.model
      });
      return this;
    }
  });

  FormRenderer.Views.NonInputResponseField = FormRenderer.Views.ResponseField.extend({
    render: function() {
      this.$el.addClass("fr_response_field_" + this.field_type);
      this.$el.html(JST['partials/non_input_response_field'](this));
      return this;
    }
  });

  FormRenderer.Views.ResponseFieldTable = FormRenderer.Views.ResponseField.extend({
    field_type: 'table',
    events: {
      'click [data-js-add-row]': 'addRow'
    },
    initialize: function() {
      FormRenderer.Views.ResponseField.prototype.initialize.apply(this, arguments);
      return this.on('shown', function() {
        return this.initExpanding();
      });
    },
    render: function() {
      FormRenderer.Views.ResponseField.prototype.render.apply(this, arguments);
      this.initExpanding();
      return this;
    },
    initExpanding: function() {},
    addRow: function() {
      this.model.numRows++;
      return this.render();
    }
  });

  FormRenderer.Views.ResponseFieldFile = FormRenderer.Views.ResponseField.extend({
    field_type: 'file',
    events: {
      'click [data-js-remove]': 'doRemove'
    },
    render: function() {
      FormRenderer.Views.ResponseField.prototype.render.apply(this, arguments);
      this.$el[this.model.hasValue() ? 'addClass' : 'removeClass']('existing');
      this.$input = this.$el.find('input');
      this.$status = this.$el.find('.upload_status');
      this.bindChangeEvent();
      return this;
    },
    bindChangeEvent: function() {
      return this.$input.on('change', $.proxy(this.fileChanged, this));
    },
    fileChanged: function(e) {
      var newFilename;
      newFilename = e.target.files != null ? e.target.files[0].name : e.target.value ? e.target.value.replace(/^.+\\/, '') : void 0;
      this.model.set('value.filename', newFilename, {
        silent: true
      });
      this.$el.find('.filename').text(newFilename);
      this.$status.text('Uploading...');
      return this.doUpload();
    },
    doUpload: function() {
      var $oldInput, $tmpForm;
      $tmpForm = $("<form method='post' style='display: inline;' />");
      $oldInput = this.$input;
      this.$input = $oldInput.clone().hide().val('').insertBefore($oldInput);
      this.bindChangeEvent();
      $oldInput.appendTo($tmpForm);
      $tmpForm.insertBefore(this.$input);
      return $tmpForm.ajaxSubmit({
        url: "" + this.form_renderer.options.screendoorBase + "/api/form_renderer/file",
        data: {
          replace_file_id: this.model.get('value.id'),
          v: 0
        },
        dataType: 'json',
        uploadProgress: (function(_this) {
          return function(_, __, ___, percentComplete) {
            return _this.$status.text(percentComplete === 100 ? 'Finishing up...' : "Uploading... (" + percentComplete + "%)");
          };
        })(this),
        complete: (function(_this) {
          return function() {
            return $tmpForm.remove();
          };
        })(this),
        success: (function(_this) {
          return function(data) {
            _this.model.set('value.id', data.file_id);
            _this.form_renderer.autosaveImmediately();
            return _this.render();
          };
        })(this),
        error: (function(_this) {
          return function(data) {
            _this.$status.text('Error');
            return setTimeout(function() {
              return _this.render();
            }, 2000);
          };
        })(this)
      });
    },
    doRemove: function() {
      this.model.set('value', {});
      this.form_renderer.autosaveImmediately();
      return this.render();
    }
  });

  FormRenderer.Views.ResponseFieldMapMarker = FormRenderer.Views.ResponseField.extend({
    field_type: 'map_marker',
    events: {
      'click .fr_map_cover': 'enable',
      'click [data-js-clear]': 'disable'
    },
    initialize: function() {
      FormRenderer.Views.ResponseField.prototype.initialize.apply(this, arguments);
      return this.on('shown', function() {
        var _ref;
        return (_ref = this.map) != null ? _ref._onResize() : void 0;
      });
    },
    render: function() {
      FormRenderer.Views.ResponseField.prototype.render.apply(this, arguments);
      this.$cover = this.$el.find('.fr_map_cover');
      this.loadLeaflet((function(_this) {
        return function() {
          _this.initMap();
          if (_this.model.latLng()) {
            return _this.enable();
          }
        };
      })(this));
      return this;
    },
    loadLeaflet: function(cb) {
      if ((typeof L !== "undefined" && L !== null ? L.GeoJSON : void 0) != null) {
        return cb();
      } else if (!FormRenderer.loadingLeaflet) {
        FormRenderer.loadingLeaflet = [cb];
        return $.getScript(FormRenderer.LEAFLET_JS_URL, function() {
          var x, _i, _len, _ref, _results;
          _ref = FormRenderer.loadingLeaflet;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            x = _ref[_i];
            _results.push(x());
          }
          return _results;
        });
      } else {
        return FormRenderer.loadingLeaflet.push(cb);
      }
    },
    initMap: function() {
      this.map = L.map(this.$el.find('.fr_map_map')[0]).setView(this.model.latLng() || this.model.defaultLatLng() || FormRenderer.DEFAULT_LAT_LNG, 13);
      this.$el.find('.fr_map_map').data('map', this.map);
      L.tileLayer(FormRenderer.MAP_TILE_URL, {
        maxZoom: 18
      }).addTo(this.map);
      this.marker = L.marker([0, 0]);
      return this.map.on('move', (function(_this) {
        return function() {
          var center;
          center = _this.map.getCenter();
          _this.marker.setLatLng(center);
          _this.model.set('value.lat', center.lat.toFixed(7));
          return _this.model.set('value.lng', center.lng.toFixed(7));
        };
      })(this));
    },
    enable: function() {
      this.map.addLayer(this.marker);
      this.$cover.hide();
      return this.map.fire('move');
    },
    disable: function() {
      this.map.removeLayer(this.marker);
      this.$el.find('.fr_map_cover').show();
      return this.model.set({
        value: {
          lat: '',
          lng: ''
        }
      });
    }
  });

  _ref = _.without(FormRenderer.INPUT_FIELD_TYPES, 'table', 'file', 'map_marker');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    i = _ref[_i];
    FormRenderer.Views["ResponseField" + (_.str.classify(i))] = FormRenderer.Views.ResponseField.extend({
      field_type: i
    });
  }

  _ref1 = FormRenderer.NON_INPUT_FIELD_TYPES;
  for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
    i = _ref1[_j];
    FormRenderer.Views["ResponseField" + (_.str.classify(i))] = FormRenderer.Views.NonInputResponseField.extend({
      field_type: i
    });
  }

}).call(this);

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/address"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var format, k, v;
    
      format = this.model.get('field_options.address_format');
    
      _print(_safe('\n\n'));
    
      if (format !== 'city_state' && format !== 'city_state_zip' && format !== 'country') {
        _print(_safe('\n  <div class=\'fr_input_grid\'>\n    <div class=\'fr_item_full\'>\n      <input type="text"\n             id="'));
        _print(this.getDomId());
        _print(_safe('"\n             data-rv-input=\'model.value.street\' />\n      <label>Address</label>\n    </div>\n  </div>\n'));
      }
    
      _print(_safe('\n\n'));
    
      if (format !== 'country') {
        _print(_safe('\n  <div class=\'fr_input_grid\'>\n    <div class=\'fr_item_half\'>\n      <input type="text"\n             data-rv-input=\'model.value.city\' />\n      <label>City</label>\n    </div>\n\n    <div class=\'fr_item_half\'>\n      <input type="text"\n             data-rv-input=\'model.value.state\' />\n      <label>State / Province / Region</label>\n    </div>\n  </div>\n'));
      }
    
      _print(_safe('\n\n<div class=\'fr_input_grid\'>\n  '));
    
      if (format !== 'city_state' && format !== 'country') {
        _print(_safe('\n    <div class=\'fr_item_half\'>\n      <input type="text"\n             data-rv-input=\'model.value.zipcode\' />\n      <label>Zipcode</label>\n    </div>\n  '));
      }
    
      _print(_safe('\n\n  '));
    
      if (format !== 'city_state' && format !== 'city_state_zip') {
        _print(_safe('\n    <div class=\'fr_item_half\'>\n      <select data-rv-value=\'model.value.country\'>\n        '));
        for (k in ISOCountryNames) {
          v = ISOCountryNames[k];
          _print(_safe('\n          <option value=\''));
          _print(k);
          _print(_safe('\'>'));
          _print(v);
          _print(_safe('</option>\n        '));
        }
        _print(_safe('\n      </select>\n      <label>Country</label>\n    </div>\n  '));
      }
    
      _print(_safe('\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/block_of_text"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'size_'));
    
      _print(this.model.get('field_options.size'));
    
      _print(_safe('\'>\n  '));
    
      _print(_safe(_.sanitize(_.simpleFormat(this.model.get('field_options.description'), false))));
    
      _print(_safe('\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/checkboxes"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var i, option, _i, _len, _ref;
    
      _ref = this.model.getOptions();
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        option = _ref[i];
        _print(_safe('\n  <label class=\'fr_option\'>\n    <input type=\'checkbox\' data-rv-checked=\'model.value.'));
        _print(i);
        _print(_safe('\' />\n    '));
        _print(option.label);
        _print(_safe('\n  </label>\n'));
      }
    
      _print(_safe('\n\n'));
    
      if (this.model.get('field_options.include_other_option')) {
        _print(_safe('\n  <div class=\'fr_option fr_other_option\'>\n    <label>\n      <input type=\'checkbox\' data-rv-checked=\'model.value.other_checkbox\' />\n      Other\n    </label>\n\n    <input type=\'text\' data-rv-input=\'model.value.other\' />\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/date"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_input_grid\'>\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n           data-rv-input=\'model.value.month\'\n           maxlength=\'2\'\n           size=\'2\' />\n    <label>MM</label>\n  </div>\n\n  <div class=\'fr_item_above\'>/</div>\n\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           data-rv-input=\'model.value.day\'\n           maxlength=\'2\'\n           size=\'2\' />\n    <label>DD</label>\n  </div>\n\n  <div class=\'fr_item_above\'>/</div>\n\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           data-rv-input=\'model.value.year\'\n           maxlength=\'4\'\n           size=\'4\' />\n    <label>YYYY</label>\n  </div>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/dropdown"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var option, _i, _len, _ref;
    
      _print(_safe('<select id="'));
    
      _print(this.getDomId());
    
      _print(_safe('" data-rv-value=\'model.value\'>\n  '));
    
      if (this.model.get('field_options.include_blank_option')) {
        _print(_safe('\n    <option></option>\n  '));
      }
    
      _print(_safe('\n\n  '));
    
      _ref = this.model.getOptions();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        option = _ref[_i];
        _print(_safe('\n    <option value="'));
        _print(option.label);
        _print(_safe('">'));
        _print(option.label);
        _print(_safe('</option>\n  '));
      }
    
      _print(_safe('\n</select>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/email"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<input type="text" inputmode="email"\n       id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n       data-rv-input=\'model.value\' />\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/file"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'existing\'>\n  <span class=\'filename\'>'));
    
      _print(this.model.get('value.filename'));
    
      _print(_safe('</span>\n  <button data-js-remove class=\''));
    
      _print(FormRenderer.BUTTON_CLASS);
    
      _print(_safe('\'>Remove</button>\n</div>\n\n<div class=\'not_existing\'>\n  <input type=\'file\' id=\''));
    
      _print(this.getDomId());
    
      _print(_safe('\' name=\'file\'>\n  <span class=\'upload_status\'></span>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/map_marker"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_map_wrapper\'>\n  <div class=\'fr_map_map\' />\n\n  <div class=\'fr_map_cover\'>\n    Click to set location\n  </div>\n\n  <div class=\'fr_map_toolbar fr_cf\'>\n    <strong>Coordinates:</strong>\n    <span data-rv-show=\'model.value.lat\'>\n      <span data-rv-text=\'model.value.lat\' />,\n      <span data-rv-text=\'model.value.lng\' />\n    </span>\n    <span data-rv-hide=\'model.value.lat\' class=\'fr_map_no_location\'>N/A</span>\n    <a data-js-clear data-rv-show=\'model.value.lat\' href=\'javascript:void(0);\'>Clear</a>\n  </div>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/number"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<input type="text"\n       id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n       data-rv-input=\'model.value\' />\n\n'));
    
      if (this.model.get('field_options.units')) {
        _print(_safe('\n  <span class=\'units\'>\n    '));
        _print(this.model.get('field_options.units'));
        _print(_safe('\n  </span>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/page_break"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_page_break_inner\'>\n  Page break\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/paragraph"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<textarea\n   id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n   class="size_'));
    
      _print(this.model.get('field_options.size'));
    
      _print(_safe('"\n   data-rv-input=\'model.value\' />\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/price"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_input_grid\'>\n  <div class=\'fr_item_above\'>$</div>\n\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n           data-rv-input=\'model.value.dollars\'\n           size=\'6\' />\n    <label>Dollars</label>\n  </div>\n\n  '));
    
      if (!this.model.get('field_options.disable_cents')) {
        _print(_safe('\n    <div class=\'fr_item_auto\'>\n      <input type="text"\n             data-rv-input=\'model.value.cents\'\n             maxlength=\'2\'\n             size=\'2\' />\n      <label>Cents</label>\n    </div>\n  '));
      }
    
      _print(_safe('\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/radio"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var i, option, _i, _len, _ref;
    
      _ref = this.model.getOptions();
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        option = _ref[i];
        _print(_safe('\n  <label class=\'fr_option\'>\n    <input type=\'radio\'\n           data-rv-checked=\'model.value.selected\'\n           id="'));
        _print(this.getDomId());
        _print(_safe('"\n           name="'));
        _print(this.getDomId());
        _print(_safe('"\n           value="'));
        _print(option.label);
        _print(_safe('" />\n    '));
        _print(option.label);
        _print(_safe('\n  </label>\n'));
      }
    
      _print(_safe('\n\n'));
    
      if (this.model.get('field_options.include_other_option')) {
        _print(_safe('\n  <div class=\'fr_option fr_other_option\'>\n    <label>\n    <input type=\'radio\' data-rv-checked=\'model.value.selected\' id="'));
        _print(this.getDomId());
        _print(_safe('" name="'));
        _print(this.getDomId());
        _print(_safe('" value="Other" />\n      Other\n    </label>\n\n    <input type=\'text\' data-rv-input=\'model.value.other\' />\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/section_break"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'size_'));
    
      _print(this.model.get('field_options.size'));
    
      _print(_safe('\'>\n  <div class=\'fr_section_name\'>'));
    
      _print(this.model.get('label'));
    
      _print(_safe('</div>\n  '));
    
      if (this.model.get('field_options.description')) {
        _print(_safe('\n    <p>'));
        _print(_safe(_.sanitize(_.simpleFormat(this.model.get('field_options.description'), false))));
        _print(_safe('</p>\n  '));
      }
    
      _print(_safe('\n</div>\n\n<hr />\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/table"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var column, i, j, _i, _j, _k, _l, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
    
      _print(_safe('<table class=\'fr_table\'>\n  <thead>\n    <tr>\n      '));
    
      _ref = this.model.getColumns();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        column = _ref[_i];
        _print(_safe('\n        <th>'));
        _print(column.label);
        _print(_safe('</th>\n      '));
      }
    
      _print(_safe('\n    </tr>\n  </thead>\n\n  <tbody>\n    '));
    
      for (i = _j = 0, _ref1 = this.model.numRows - 1; 0 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
        _print(_safe('\n      <tr>\n        '));
        _ref2 = this.model.getColumns();
        for (j = _k = 0, _len1 = _ref2.length; _k < _len1; j = ++_k) {
          column = _ref2[j];
          _print(_safe('\n          <td>\n            <textarea '));
          if (this.model.getPresetValue(column.label, i)) {
            _print(_safe('readonly'));
          }
          _print(_safe('\n                      data-col=\''));
          _print(j);
          _print(_safe('\'\n                      data-row=\''));
          _print(i);
          _print(_safe('\'\n                      data-rv-input=\'model.value.'));
          _print(j);
          _print(_safe('.'));
          _print(i);
          _print(_safe('\'\n                      rows=\'1\' />\n          </td>\n        '));
        }
        _print(_safe('\n      </tr>\n    '));
      }
    
      _print(_safe('\n  </tbody>\n\n  '));
    
      if (this.model.get('field_options.column_totals')) {
        _print(_safe('\n    <tfoot>\n      <tr>\n        '));
        _ref3 = this.model.getColumns();
        for (j = _l = 0, _len2 = _ref3.length; _l < _len2; j = ++_l) {
          column = _ref3[j];
          _print(_safe('\n          <td data-rv-text=\'model.columnTotals.'));
          _print(j);
          _print(_safe('\'></td>\n        '));
        }
        _print(_safe('\n      </tr>\n    </tfoot>\n  '));
      }
    
      _print(_safe('\n</table>\n\n<div class=\'fr_table_add_row_wrapper\'>\n  <a data-js-add-row href=\'javascript:void(0)\'><i class=\'icon-plus-sign\'></i> Add another row</a>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/text"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<input type="text"\n       id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n       class="size_'));
    
      _print(this.model.get('field_options.size'));
    
      _print(_safe('"\n       data-rv-input=\'model.value\' />\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/time"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_input_grid\'>\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n           data-rv-input=\'model.value.hours\'\n           maxlength=\'2\'\n           size=\'2\' />\n    <label>HH</label>\n  </div>\n\n  <div class=\'fr_item_above\'>:</div>\n\n  <div class=\'fr_item_auto\'>\n    <input type="text"\n           data-rv-input=\'model.value.minutes\'\n           maxlength=\'2\'\n           size=\'2\' />\n    <label>MM</label>\n  </div>\n\n  '));
    
      if (!this.model.get('field_options.disable_seconds')) {
        _print(_safe('\n    <div class=\'fr_item_above\'>:</div>\n\n    <div class=\'fr_item_auto\'>\n      <input type="text"\n             data-rv-input=\'model.value.seconds\'\n             maxlength=\'2\'\n             size=\'2\' />\n      <label>SS</label>\n    </div>\n  '));
      }
    
      _print(_safe('\n\n  <div class=\'fr_item_auto\'>\n    <select data-rv-value=\'model.value.am_pm\'>\n      <option value=\'AM\'>AM</option>\n      <option value=\'PM\'>PM</option>\n    </select>\n  </div>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["fields/website"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<input type="text" inputmode="url"\n       id="'));
    
      _print(this.getDomId());
    
      _print(_safe('"\n       data-rv-input=\'model.value\'\n       placeholder=\'http://\' />\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["main"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_loading\'>\n  Loading form...\n</div>'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/bottom_status_bar"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<div class=\'fr_bottom_bar fr_cf\'>\n  '));
    
      if (this.form_renderer.options.enableAutosave) {
        _print(_safe('\n    <div class=\'fr_bottom_bar_l\'>\n      '));
        if (this.form_renderer.state.get('hasServerErrors')) {
          _print(_safe('\n        Error saving\n      '));
        } else if (this.form_renderer.state.get('hasChanges')) {
          _print(_safe('\n        Saving...\n      '));
        } else {
          _print(_safe('\n        Saved\n      '));
        }
        _print(_safe('\n    </div>\n  '));
      }
    
      _print(_safe('\n\n  <div class=\'fr_bottom_bar_r\'>\n    '));
    
      if (!this.firstPage()) {
        _print(_safe('\n      <button data-js-back class=\''));
        _print(FormRenderer.BUTTON_CLASS);
        _print(_safe('\'>\n        Back to page '));
        _print(this.previousPage());
        _print(_safe('\n      </button>\n    '));
      }
    
      _print(_safe('\n\n    '));
    
      if (this.form_renderer.state.get('submitting')) {
        _print(_safe('\n      <button disabled class=\''));
        _print(FormRenderer.BUTTON_CLASS);
        _print(_safe('\'>\n        Submitting...\n      </button>\n    '));
      } else {
        _print(_safe('\n      <button data-js-continue class=\''));
        _print(FormRenderer.BUTTON_CLASS);
        _print(_safe('\'>\n        '));
        if (this.lastPage() || !this.form_renderer.options.enablePages) {
          _print(_safe('Submit'));
        } else {
          _print(_safe('Next page'));
        }
        _print(_safe('\n      </button>\n    '));
      }
    
      _print(_safe('\n  </div>\n</div>\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/description"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      if (this.model.get('field_options.description')) {
        _print(_safe('\n  <div class=\'fr_description\'>\n    '));
        _print(_safe(_.sanitize(_.simpleFormat(this.model.get('field_options.description'), false))));
        _print(_safe('\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/error"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      if (this.model.getError()) {
        _print(_safe('\n  <div class=\'fr_error\'>\n    '));
        _print(this.model.getError());
        _print(_safe('\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/error_alert_bar"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      if (!this.form_renderer.areAllPagesValid()) {
        _print(_safe('\n  <div class=\'fr_error_alert_bar\'>Your response has validation errors.</div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/label"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe('<label for="'));
    
      _print(this.getDomId());
    
      _print(_safe('">\n  '));
    
      _print(this.model.get('label'));
    
      _print(_safe('\n  '));
    
      if (this.model.get('required')) {
        _print(_safe('<abbr title=\'required\'>*</abbr>'));
      }
    
      _print(_safe('\n</label>'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/length_validations"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      if (this.model.hasLengthValidations()) {
        _print(_safe('\n  <div class=\'fr_min_max\'>\n    '));
        if (this.model.get('field_options.minlength') && this.model.get('field_options.maxlength')) {
          _print(_safe('\n      Between '));
          _print(this.model.get('field_options.minlength'));
          _print(_safe(' and '));
          _print(this.model.get('field_options.maxlength'));
          _print(_safe(' '));
          _print(this.model.getLengthValidationUnits());
          _print(_safe('.\n    '));
        } else if (this.model.get('field_options.minlength')) {
          _print(_safe('\n      More than '));
          _print(this.model.get('field_options.minlength'));
          _print(_safe(' '));
          _print(this.model.getLengthValidationUnits());
          _print(_safe('.\n    '));
        } else if (this.model.get('field_options.maxlength')) {
          _print(_safe('\n      Less than '));
          _print(this.model.get('field_options.maxlength'));
          _print(_safe(' '));
          _print(this.model.getLengthValidationUnits());
          _print(_safe('.\n    '));
        }
        _print(_safe('\n\n    Current count:\n    <code class=\'fr_min_max_counter\' data-rv-text=\'model.currentLength\'></code>\n    '));
        _print(this.model.getLengthValidationUnits());
        _print(_safe('.\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/min_max_validations"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      if (this.model.hasMinMaxValidations()) {
        _print(_safe('\n  <div class=\'fr_min_max\'>\n    '));
        if (this.model.get('field_options.min') && this.model.get('field_options.max')) {
          _print(_safe('\n      Between '));
          _print(this.model.get('field_options.min'));
          _print(_safe(' and '));
          _print(this.model.get('field_options.max'));
          _print(_safe('.\n    '));
        } else if (this.model.get('field_options.min')) {
          _print(_safe('\n      More than '));
          _print(this.model.get('field_options.min'));
          _print(_safe('.\n    '));
        } else if (this.model.get('field_options.max')) {
          _print(_safe('\n      Less than '));
          _print(this.model.get('field_options.max'));
          _print(_safe('.\n    '));
        }
        _print(_safe('\n  </div>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/non_input_response_field"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe(JST["fields/" + this.field_type](this)));
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/pagination"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      var i, _i, _ref;
    
      if (this.form_renderer.numPages > 1) {
        _print(_safe('\n  <ul class=\'fr_pagination fr_cf\'>\n    '));
        for (i = _i = 1, _ref = this.form_renderer.numPages; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
          _print(_safe('\n      '));
          if (i === this.form_renderer.state.get('activePage')) {
            _print(_safe('\n        <li class=\''));
            if (!this.form_renderer.isPageValid(i)) {
              _print(_safe('has_errors'));
            }
            _print(_safe('\'><span>'));
            _print(i);
            _print(_safe('</span></li>\n      '));
          } else {
            _print(_safe('\n        <li class=\''));
            if (!this.form_renderer.isPageValid(i)) {
              _print(_safe('has_errors'));
            }
            _print(_safe('\'><a data-activate-page="'));
            _print(i);
            _print(_safe('" href=\'javascript:void(0)\'>'));
            _print(i);
            _print(_safe('</a></li>\n      '));
          }
          _print(_safe('\n    '));
        }
        _print(_safe('\n  </ul>\n'));
      }
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};

if (!window.JST) {
  window.JST = {};
}
window.JST["partials/response_field"] = function(__obj) {
  var _safe = function(value) {
    if (typeof value === 'undefined' && value == null)
      value = '';
    var result = new String(value);
    result.ecoSafe = true;
    return result;
  };
  return (function() {
    var __out = [], __self = this, _print = function(value) {
      if (typeof value !== 'undefined' && value != null)
        __out.push(value.ecoSafe ? value : __self.escape(value));
    }, _capture = function(callback) {
      var out = __out, result;
      __out = [];
      callback.call(this);
      result = __out.join('');
      __out = out;
      return _safe(result);
    };
    (function() {
      _print(_safe(JST["partials/label"](this)));
    
      _print(_safe('\n'));
    
      _print(_safe(JST["fields/" + this.field_type](this)));
    
      _print(_safe('\n\n<div class=\'fr_clear\' />\n\n'));
    
      _print(_safe(JST["partials/length_validations"](this)));
    
      _print(_safe('\n'));
    
      _print(_safe(JST["partials/min_max_validations"](this)));
    
      _print(_safe('\n'));
    
      _print(_safe(JST["partials/error"](this)));
    
      _print(_safe('\n'));
    
      _print(_safe(JST["partials/description"](this)));
    
      _print(_safe('\n'));
    
    }).call(this);
    
    return __out.join('');
  }).call((function() {
    var obj = {
      escape: function(value) {
        return ('' + value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      safe: _safe
    }, key;
    for (key in __obj) obj[key] = __obj[key];
    return obj;
  })());
};
