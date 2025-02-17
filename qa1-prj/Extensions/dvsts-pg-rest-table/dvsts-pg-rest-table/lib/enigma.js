/**
 * enigma.js v2.11.0
 * Copyright (c) 2023 QlikTech International AB
 * This library is licensed under MIT - See the LICENSE file for full details
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.enigma = factory());
})(this, (function () { 'use strict';

  /**
   * Utility functions
   */

  var util = {};

  util.isObject = function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  };

  util.isNumber = function isNumber(arg) {
    return typeof arg === 'number';
  };

  util.isUndefined = function isUndefined(arg) {
    return arg === void 0;
  };

  util.isFunction = function isFunction(arg){
    return typeof arg === 'function';
  };


  /**
   * EventEmitter class
   */

  function EventEmitter() {
    EventEmitter.init.call(this);
  }
  var nodeEventEmitter = EventEmitter;

  // Backwards-compat with node 0.10.x
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  EventEmitter.init = function() {
    this._events = this._events || {};
    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function(n) {
    if (!util.isNumber(n) || n < 0 || isNaN(n))
      throw TypeError('n must be a positive number');
    this._maxListeners = n;
    return this;
  };

  EventEmitter.prototype.emit = function(type) {
    var er, handler, len, args, i, listeners;

    if (!this._events)
      this._events = {};

    // If there is no 'error' event listener then throw.
    if (type === 'error' && !this._events.error) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw Error('Uncaught, unspecified "error" event.');
      }
    }

    handler = this._events[type];

    if (util.isUndefined(handler))
      return false;

    if (util.isFunction(handler)) {
      switch (arguments.length) {
        // fast cases
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        // slower
        default:
          len = arguments.length;
          args = new Array(len - 1);
          for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];
          handler.apply(this, args);
      }
    } else if (util.isObject(handler)) {
      len = arguments.length;
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];

      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++)
        listeners[i].apply(this, args);
    }

    return true;
  };

  EventEmitter.prototype.addListener = function(type, listener) {
    var m;

    if (!util.isFunction(listener))
      throw TypeError('listener must be a function');

    if (!this._events)
      this._events = {};

    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (this._events.newListener)
      this.emit('newListener', type,
                util.isFunction(listener.listener) ?
                listener.listener : listener);

    if (!this._events[type])
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    else if (util.isObject(this._events[type]))
      // If we've already got an array, just append.
      this._events[type].push(listener);
    else
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];

    // Check for listener leak
    if (util.isObject(this._events[type]) && !this._events[type].warned) {
      var m;
      if (!util.isUndefined(this._maxListeners)) {
        m = this._maxListeners;
      } else {
        m = EventEmitter.defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;

        if (util.isFunction(console.error)) {
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
        }
        if (util.isFunction(console.trace))
          console.trace();
      }
    }

    return this;
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.once = function(type, listener) {
    if (!util.isFunction(listener))
      throw TypeError('listener must be a function');

    var fired = false;

    function g() {
      this.removeListener(type, g);

      if (!fired) {
        fired = true;
        listener.apply(this, arguments);
      }
    }

    g.listener = listener;
    this.on(type, g);

    return this;
  };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener = function(type, listener) {
    var list, position, length, i;

    if (!util.isFunction(listener))
      throw TypeError('listener must be a function');

    if (!this._events || !this._events[type])
      return this;

    list = this._events[type];
    length = list.length;
    position = -1;

    if (list === listener ||
        (util.isFunction(list.listener) && list.listener === listener)) {
      delete this._events[type];
      if (this._events.removeListener)
        this.emit('removeListener', type, listener);

    } else if (util.isObject(list)) {
      for (i = length; i-- > 0;) {
        if (list[i] === listener ||
            (list[i].listener && list[i].listener === listener)) {
          position = i;
          break;
        }
      }

      if (position < 0)
        return this;

      if (list.length === 1) {
        list.length = 0;
        delete this._events[type];
      } else {
        list.splice(position, 1);
      }

      if (this._events.removeListener)
        this.emit('removeListener', type, listener);
    }

    return this;
  };

  EventEmitter.prototype.removeAllListeners = function(type) {
    var key, listeners;

    if (!this._events)
      return this;

    // not listening for removeListener, no need to emit
    if (!this._events.removeListener) {
      if (arguments.length === 0)
        this._events = {};
      else if (this._events[type])
        delete this._events[type];
      return this;
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {
      for (key in this._events) {
        if (key === 'removeListener') continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = {};
      return this;
    }

    listeners = this._events[type];

    if (util.isFunction(listeners)) {
      this.removeListener(type, listeners);
    } else if (Array.isArray(listeners)) {
      // LIFO order
      while (listeners.length)
        this.removeListener(type, listeners[listeners.length - 1]);
    }
    delete this._events[type];

    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    var ret;
    if (!this._events || !this._events[type])
      ret = [];
    else if (util.isFunction(this._events[type]))
      ret = [this._events[type]];
    else
      ret = this._events[type].slice();
    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    var ret;
    if (!emitter._events || !emitter._events[type])
      ret = 0;
    else if (util.isFunction(emitter._events[type]))
      ret = 1;
    else
      ret = emitter._events[type].length;
    return ret;
  };

  /**
  * @module EventEmitter
  * @private
  */
  var Events = {
    /**
    * Function used to add event handling to objects passed in.
    * @param {Object} obj Object instance that will get event handling.
    */
    mixin: function mixin(obj) {
      Object.keys(nodeEventEmitter.prototype).forEach(function (key) {
        obj[key] = nodeEventEmitter.prototype[key];
      });
      nodeEventEmitter.init(obj);
    }
  };

  function _typeof$b(obj) { "@babel/helpers - typeof"; return _typeof$b = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$b(obj); }
  function _defineProperties$9(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$9(descriptor.key), descriptor); } }
  function _createClass$9(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$9(Constructor.prototype, protoProps); if (staticProps) _defineProperties$9(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$9(arg) { var key = _toPrimitive$9(arg, "string"); return _typeof$b(key) === "symbol" ? key : String(key); }
  function _toPrimitive$9(input, hint) { if (_typeof$b(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$b(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  function _classCallCheck$9(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _inherits$1(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf$1(subClass, superClass); }
  function _createSuper$1(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$1(); return function _createSuperInternal() { var Super = _getPrototypeOf$1(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$1(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$1(this, result); }; }
  function _possibleConstructorReturn$1(self, call) { if (call && (_typeof$b(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized$1(self); }
  function _assertThisInitialized$1(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
  function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf$1(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf$1(Wrapper, Class); }; return _wrapNativeSuper(Class); }
  function _construct(Parent, args, Class) { if (_isNativeReflectConstruct$1()) { _construct = Reflect.construct.bind(); } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf$1(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }
  function _isNativeReflectConstruct$1() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }
  function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }
  function _setPrototypeOf$1(o, p) { _setPrototypeOf$1 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$1(o, p); }
  function _getPrototypeOf$1(o) { _getPrototypeOf$1 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$1(o); }
  /**
   * Error containing a custom error code.
   * @extends Error
   * @property {number} code The error code as defined by `errorCodes`.
   * @property {boolean} enigmaError=true
   * @property {Object} [original] the websocket event that is the source of the error.
   */
  var EnigmaError = /*#__PURE__*/function (_Error) {
    _inherits$1(EnigmaError, _Error);
    var _super = _createSuper$1(EnigmaError);
    function EnigmaError(name, code, original) {
      var _this;
      _classCallCheck$9(this, EnigmaError);
      _this = _super.call(this, name);
      _this.code = code;
      _this.enigmaError = true;
      _this.original = original;
      return _this;
    }
    return _createClass$9(EnigmaError);
  }( /*#__PURE__*/_wrapNativeSuper(Error));
  /**
   * Create an enigmaError
   * @private
   * @param {Number} code A proper error code from `errorCodes`
   * @param {String} name A message/name of the enigmaError.
   * @param {Object} [original] the websocket event that is the source of the error.
   * @returns {EnigmaError}
   */
  function createEnigmaError(code, name, original) {
    return new EnigmaError(name, code, original);
  }

  /**
   * This is a list of error codes that can be thrown from enigma.js API calls.
   * @entry
   * @see EnigmaError
   * @enum
   * @example <caption>Handling an enigma.js error</caption>
   * const { NOT_CONNECTED } = require('enigma.js/error-codes');
   * try {
   *   const layout = await model.getLayout();
   * } catch (err) {
   *   if (err.code === NOT_CONNECTED) {
   *     console.log('Tried to communicate on a session that is closed');
   *   }
   * }
   */
  var errorCodes = {
    /**
     * You're trying to send data on a socket that's not connected.
     * @type {number}
     */
    NOT_CONNECTED: -1,
    /**
     * The object you're trying to fetch does not exist.
     * @type {number}
     */
    OBJECT_NOT_FOUND: -2,
    /**
     * Unexpected RPC response, expected array of patches.
     * @type {number}
     */
    EXPECTED_ARRAY_OF_PATCHES: -3,
    /**
     * Not an object that can be patched.
     * @type {number}
     */
    PATCH_HAS_NO_PARENT: -4,
    /**
     * This entry is already defined with another key.
     * @type {number}
     */
    ENTRY_ALREADY_DEFINED: -5,
    /**
     * You need to supply a configuration.
     * @type {number}
     */
    NO_CONFIG_SUPPLIED: -6,
    /**
     * There's no promise object available (polyfill required?).
     * @type {number}
     */
    PROMISE_REQUIRED: -7,
    /**
     * The schema struct type you requested does not exist.
     * @type {number}
     */
    SCHEMA_STRUCT_TYPE_NOT_FOUND: -8,
    /**
     * Can't override this function.
     * @type {number}
     */
    SCHEMA_MIXIN_CANT_OVERRIDE_FUNCTION: -9,
    /**
     * Extend is not allowed for this mixin.
     * @type {number}
     */
    SCHEMA_MIXIN_EXTEND_NOT_ALLOWED: -10,
    /**
     * Session suspended - no interaction allowed.
     * @type {number}
     */
    SESSION_SUSPENDED: -11,
    /**
     * onlyIfAttached supplied, but you got SESSION_CREATED.
     * @type {number}
     */
    SESSION_NOT_ATTACHED: -12
  };

  function _typeof$a(obj) { "@babel/helpers - typeof"; return _typeof$a = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$a(obj); }
  function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
  function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
  function _defineProperty(obj, key, value) { key = _toPropertyKey$8(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
  function _classCallCheck$8(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$8(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$8(descriptor.key), descriptor); } }
  function _createClass$8(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$8(Constructor.prototype, protoProps); if (staticProps) _defineProperties$8(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$8(arg) { var key = _toPrimitive$8(arg, "string"); return _typeof$a(key) === "symbol" ? key : String(key); }
  function _toPrimitive$8(input, hint) { if (_typeof$a(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$a(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  var RPC_CLOSE_NORMAL = 1000;
  var RPC_CLOSE_MANUAL_SUSPEND$1 = 4000;
  var cacheId = 0;

  /**
   * The QIX Engine session object.
   */
  var Session = /*#__PURE__*/function () {
    /**
     * Handles all JSON-RPC notification events, 'notification:* or handles a specific JSON-RPC
     * notification event, 'notification:OnConnected'. These events depend on the product from which
     * you use QIX Engine.
     * @event Session#notification
     * @type {Object}
     * @example <caption>Bind the notification events</caption>
     * // bind all notifications to console.log:
     * session.on('notification:*', console.log);
     * // bind a specific notification to console.log:
     * session.on('notification:OnConnected', console.log);
     */

    /**
     * Handles websocket messages. Generally used for debugging purposes. `traffic:*` will handle all
     * websocket messages, `traffic:sent` will handle outgoing messages, and `traffic:received` will
     * handle incoming messages.
     * @event Session#traffic
     * @type {Object}
     * @example <caption>Bind the traffic events</caption>
     * // bind both in- and outbound traffic to console.log:
     * session.on('traffic:*', console.log);
     * // bind outbound traffic to console.log:
     * session.on('traffic:sent', console.log);
     * // bind inbound traffic to console.log:
     * session.on('traffic:received', console.log);
     */

    function Session(options) {
      _classCallCheck$8(this, Session);
      var session = this;
      Object.assign(session, options);
      this.Promise = this.config.Promise;
      this.definition = this.config.definition;
      Events.mixin(session);
      cacheId += 1;
      session.id = cacheId;
      session.rpc.on('socket-error', session.onRpcError.bind(session));
      session.rpc.on('closed', session.onRpcClosed.bind(session));
      session.rpc.on('message', session.onRpcMessage.bind(session));
      session.rpc.on('notification', session.onRpcNotification.bind(session));
      session.rpc.on('traffic', session.onRpcTraffic.bind(session));
      session.on('closed', function () {
        return session.onSessionClosed();
      });
    }

    /**
    * Event handler for re-triggering error events from RPC.
    * @private
    * @emits socket-error
    * @param {Error} err Webocket error event.
    */
    _createClass$8(Session, [{
      key: "onRpcError",
      value: function onRpcError(err) {
        if (this.suspendResume.isSuspended) {
          return;
        }
        this.emit('socket-error', err);
      }

      /**
      * Event handler for the RPC close event.
      * @private
      * @emits Session#suspended
      * @emits Session#closed
      * @param {Event} evt WebSocket close event.
      */
    }, {
      key: "onRpcClosed",
      value: function onRpcClosed(evt) {
        var _this = this;
        /**
         * Handles suspended state. This event is triggered in two cases (listed below). It is useful
         * in scenarios where, for example, you want to block interaction with your application until
         * you resume again. Or, if config.suspendOnClose is true and there was a network disconnect
         * (socket closed) or if you ran session.suspend().
         * @event Session#suspended
         * @type {Object}
         * @param {Object} evt Event object.
         * @param {String} evt.initiator String indication what triggered the suspended state. Possible
         * values network, manual.
         * @example <caption>Handling session suspended</caption>
         * session.on('suspended', () => {
         *   console.log('Session was suspended, retrying...');
         *   session.resume();
         * });
         */
        if (this.suspendResume.isSuspended) {
          return;
        }
        if (evt.code === RPC_CLOSE_NORMAL || evt.code === RPC_CLOSE_MANUAL_SUSPEND$1) {
          return;
        }
        if (this.config.suspendOnClose) {
          var code = evt.code,
            reason = evt.reason;
          this.suspendResume.suspend().then(function () {
            return _this.emit('suspended', {
              initiator: 'network',
              code: code,
              reason: reason
            });
          });
        } else {
          this.emit('closed', evt);
        }
      }

      /**
      * Event handler for the RPC message event.
      * @private
      * @param {Object} response JSONRPC response.
      */
    }, {
      key: "onRpcMessage",
      value: function onRpcMessage(response) {
        var _this2 = this;
        if (this.suspendResume.isSuspended) {
          return;
        }
        if (response.change) {
          response.change.forEach(function (handle) {
            return _this2.emitHandleChanged(handle);
          });
        }
        if (response.close) {
          response.close.forEach(function (handle) {
            return _this2.emitHandleClosed(handle);
          });
        }
      }

      /**
      * Event handler for the RPC notification event.
      * @private
      * @emits Session#notification
      * @param {Object} response The JSONRPC notification.
      */
    }, {
      key: "onRpcNotification",
      value: function onRpcNotification(response) {
        this.emit('notification:*', response.method, response.params);
        this.emit("notification:".concat(response.method), response.params);
      }

      /**
      * Event handler for the RPC traffic event.
      * @private
      * @emits Session#traffic
      * @param {String} dir The traffic direction, sent or received.
      * @param {Object} data JSONRPC request/response/WebSocket message.
      * @param {Number} handle The associated handle.
      */
    }, {
      key: "onRpcTraffic",
      value: function onRpcTraffic(dir, data, handle) {
        this.emit('traffic:*', dir, data);
        this.emit("traffic:".concat(dir), data);
        var api = this.apis.getApi(handle);
        if (api) {
          api.emit('traffic:*', dir, data);
          api.emit("traffic:".concat(dir), data);
        }
      }

      /**
      * Event handler for cleaning up API instances when a session has been closed.
      * @private
      * @emits API#closed
      */
    }, {
      key: "onSessionClosed",
      value: function onSessionClosed() {
        this.apis.getApis().forEach(function (entry) {
          entry.api.emit('closed');
          entry.api.removeAllListeners();
        });
        this.apis.clear();
      }

      /**
       * Function used to get an API for a backend object.
       * @private
       * @param {Object} args Arguments used to create object API.
       * @param {Number} args.handle Handle of the backend object.
       * @param {String} args.id ID of the backend object.
       * @param {String} args.type QIX type of the backend object. Can for example
       *                           be "Doc" or "GenericVariable".
       * @param {String} args.genericType Custom type of the backend object, if defined in qInfo.
       * @returns {Object} Returns the generated and possibly augmented API.
       */
    }, {
      key: "getObjectApi",
      value: function getObjectApi(args) {
        var handle = args.handle,
          id = args.id,
          type = args.type,
          genericType = args.genericType;
        var api = this.apis.getApi(handle);
        if (api) {
          return api;
        }
        var factory = this.definition.generate(type);
        api = factory(this, handle, id, genericType);
        this.apis.add(handle, api);
        return api;
      }

      /**
      * Establishes the websocket against the configured URL and returns the Global instance.
      * @emits Session#opened
      * @returns {Promise<Object>} Eventually resolved if the connection was successful.
      * @example <caption>Opening a sesssion</caption>
      * session.open().then(() => {
      *   console.log('Session was opened');
      * });
      */
    }, {
      key: "open",
      value: function open() {
        var _this3 = this;
        /**
         * Handles opened state. This event is triggered whenever the websocket is connected and
         * ready for communication.
         * @event Session#opened
         * @type {Object}
         * @example <caption>Bind the session opened event</caption>
         * session.on('opened', () => {
         *   console.log('Session was opened');
         * });
         */
        if (!this.globalPromise) {
          var args = {
            handle: -1,
            id: 'Global',
            type: 'Global',
            genericType: 'Global'
          };
          this.globalPromise = this.rpc.open().then(function () {
            return _this3.getObjectApi(args);
          }).then(function (global) {
            _this3.emit('opened');
            return global;
          });
        }
        return this.globalPromise;
      }

      /**
      * Function used to send data on the RPC socket.
      * @param {Object} request The request to be sent. (data and some meta info)
      * @returns {Object} Returns a promise instance.
      */
    }, {
      key: "send",
      value: function send(request) {
        var _this4 = this;
        if (this.suspendResume.isSuspended) {
          return this.Promise.reject(createEnigmaError(errorCodes.SESSION_SUSPENDED, 'Session suspended', this.rpc.closeEvent));
        }
        request.id = this.rpc.createRequestId();
        var promise = this.intercept.executeRequests(this, this.Promise.resolve(request)).then(function (augmentedRequest) {
          var data = _objectSpread(_objectSpread({}, _this4.config.protocol), augmentedRequest);
          // the outKey value is used by multiple-out interceptor, at some point
          // we need to refactor that implementation and figure out how to transport
          // this value without hijacking the JSONRPC request object:
          delete data.outKey;
          var response = _this4.rpc.send(data);
          augmentedRequest.retry = function () {
            return _this4.send(request);
          };
          return _this4.intercept.executeResponses(_this4, response, augmentedRequest);
        });
        Session.addToPromiseChain(promise, 'requestId', request.id);
        return promise;
      }

      /**
      * Suspends the enigma.js session by closing the websocket and rejecting all method calls
      * until it is has resumed again.
      * @emits Session#suspended
      * @param {Number} [code=4000] - The reason code for suspending the connection.
      * @param {String} [reason=""] - The human readable string describing
      * why the connection is suspended.
      * @returns {Promise<Object>} Eventually resolved when the websocket has been closed.
      * @example <caption>Suspending a session</caption>
      * session.suspend().then(() => {
      *   console.log('Session was suspended');
      * });
      */
    }, {
      key: "suspend",
      value: function suspend() {
        var _this5 = this;
        var code = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 4000;
        var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        return this.suspendResume.suspend(code, reason).then(function () {
          return _this5.emit('suspended', {
            initiator: 'manual',
            code: code,
            reason: reason
          });
        });
      }

      /**
      * Resumes a previously suspended enigma.js session by recreating the websocket and,
      * if possible, reopen the document as well as refreshing the internal cashes. If successful,
      * changed events will be triggered on all generated APIs, and on the ones it was unable to
      * restore, the closed event will be triggered.
      * @emits Session#resumed
      * @param {Boolean} onlyIfAttached If true, resume only if the session was reattached properly.
      * @returns {Promise<Object>} Eventually resolved when the websocket (and potentially the
      * previously opened document, and generated APIs) has been restored; it is rejected when it fails
      * any of those steps, or when onlyIfAttached is true and a new session was created.
      * @example <caption>Resuming a session</caption>
      * session.resume(true).then(() => {
      *   console.log('Session was resumed by re-attaching');
      * });
      */
    }, {
      key: "resume",
      value: function resume(onlyIfAttached) {
        var _this6 = this;
        /**
         * Handles resumed state. This event is triggered when the session was properly resumed. It is
         * useful in scenarios where, for example, you can close blocking modal dialogs and allow the
         * user to interact with your application again.
         * @event Session#resumed
         * @type {Object}
         * @example <caption>Handling session resumed</caption>
         * session.on('resumed', () => {
         *   console.log('Session was resumed, we can close that "reconnecting" dialog now');
         * });
         */
        return this.suspendResume.resume(onlyIfAttached).then(function (value) {
          _this6.emit('resumed');
          return value;
        });
      }

      /**
      * Closes the websocket and cleans up internal caches. Also triggers the closed event
      * on all generated APIs. Note that you have to manually invoke this when you want to
      * close a session and config.suspendOnClose is true.
      * @emits Session#closed
      * @param {Number} [code=1000] - The reason code for closing the connection.
      * @param {String} [reason=""] - The human readable string describing why the connection is closed.
      * @returns {Promise<Object>} Eventually resolved when the websocket has been closed.
      * @example <caption>Closing a session</caption>
      * session.close().then(() => {
      *   console.log('Session was closed');
      * });
      */
    }, {
      key: "close",
      value: function close() {
        var _this7 = this;
        var code = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1000;
        var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        /**
         * Handles closed state. This event is triggered when the underlying websocket is closed and
         * config.suspendOnClose is false.
         * @event Session#closed
         * @type {Object}
         * @example <caption>Handling session closed</caption>
         * session.on('closed', () => {
         *   console.log('Session was closed, clean up!');
         * });
         */
        this.globalPromise = undefined;
        return this.rpc.close(code, reason).then(function (evt) {
          return _this7.emit('closed', evt);
        });
      }

      /**
      * Given a handle, this function will emit the 'changed' event on the
      * corresponding API instance.
      * @private
      * @param {Number} handle The handle of the API instance.
      * @emits API#changed
      */
    }, {
      key: "emitHandleChanged",
      value: function emitHandleChanged(handle) {
        var api = this.apis.getApi(handle);
        if (api) {
          api.emit('changed');
        }
      }

      /**
      * Given a handle, this function will emit the 'closed' event on the
      * corresponding API instance.
      * @private
      * @param {Number} handle The handle of the API instance.
      * @emits API#closed
      */
    }, {
      key: "emitHandleClosed",
      value: function emitHandleClosed(handle) {
        var api = this.apis.getApi(handle);
        if (api) {
          api.emit('closed');
          api.removeAllListeners();
        }
      }

      /**
      * Function used to add info on the promise chain.
      * @private
      * @param {Promise<Object>} promise The promise to add info on.
      * @param {String} name The property to add info on.
      * @param {Any} value The info to add.
      */
    }], [{
      key: "addToPromiseChain",
      value: function addToPromiseChain(promise, name, value) {
        promise[name] = value;
        var then = promise.then;
        promise.then = function patchedThen() {
          for (var _len = arguments.length, params = new Array(_len), _key = 0; _key < _len; _key++) {
            params[_key] = arguments[_key];
          }
          var chain = then.apply(this, params);
          Session.addToPromiseChain(chain, name, value);
          return chain;
        };
      }
    }]);
    return Session;
  }();

  function _typeof$9(obj) { "@babel/helpers - typeof"; return _typeof$9 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$9(obj); }
  function _classCallCheck$7(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$7(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$7(descriptor.key), descriptor); } }
  function _createClass$7(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$7(Constructor.prototype, protoProps); if (staticProps) _defineProperties$7(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$7(arg) { var key = _toPrimitive$7(arg, "string"); return _typeof$9(key) === "symbol" ? key : String(key); }
  function _toPrimitive$7(input, hint) { if (_typeof$9(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$9(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

  /**
  * Key-value cache
  * @private
  */
  var KeyValueCache = /*#__PURE__*/function () {
    function KeyValueCache() {
      _classCallCheck$7(this, KeyValueCache);
      this.entries = {};
    }

    /**
    * Adds an entry.
    * @private
    * @function KeyValueCache#add
    * @param {String} key The key representing an entry.
    * @param {*} entry The entry to be added.
    */
    _createClass$7(KeyValueCache, [{
      key: "add",
      value: function add(key, entry) {
        key += '';
        if (typeof this.entries[key] !== 'undefined') {
          throw createEnigmaError(errorCodes.ENTRY_ALREADY_DEFINED, "Entry already defined with key ".concat(key));
        }
        this.entries[key] = entry;
      }

      /**
      * Sets an entry.
      * @private
      * @function KeyValueCache#set
      * @param {String} key The key representing an entry.
      * @param {*} entry The entry.
      */
    }, {
      key: "set",
      value: function set(key, entry) {
        key += '';
        this.entries[key] = entry;
      }

      /**
      * Removes an entry.
      * @private
      * @function KeyValueCache#remove
      * @param {String} key The key representing an entry.
      */
    }, {
      key: "remove",
      value: function remove(key) {
        delete this.entries[key];
      }

      /**
      * Gets an entry.
      * @private
      * @function KeyValueCache#get
      * @param {String} key The key representing an entry.
      * @returns {*} The entry for the key.
      */
    }, {
      key: "get",
      value: function get(key) {
        return this.entries[key];
      }

      /**
      * Gets a list of all entries.
      * @private
      * @function KeyValueCache#getAll
      * @returns {Array} The list of entries including its `key` and `value` properties.
      */
    }, {
      key: "getAll",
      value: function getAll() {
        var _this = this;
        return Object.keys(this.entries).map(function (key) {
          return {
            key: key,
            value: _this.entries[key]
          };
        });
      }

      /**
      * Gets a key for an entry.
      * @private
      * @function KeyValueCache#getKey
      * @param {*} entry The entry to locate the key for.
      * @returns {String} The key representing an entry.
      */
    }, {
      key: "getKey",
      value: function getKey(entry) {
        var _this2 = this;
        return Object.keys(this.entries).filter(function (key) {
          return _this2.entries[key] === entry;
        })[0];
      }

      /**
      * Clears the cache of all entries.
      * @private
      * @function KeyValueCache#clear
      */
    }, {
      key: "clear",
      value: function clear() {
        this.entries = {};
      }
    }]);
    return KeyValueCache;
  }();

  function _classCallCheck$6(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$6(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$6(descriptor.key), descriptor); } }
  function _createClass$6(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$6(Constructor.prototype, protoProps); if (staticProps) _defineProperties$6(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$6(arg) { var key = _toPrimitive$6(arg, "string"); return _typeof$8(key) === "symbol" ? key : String(key); }
  function _toPrimitive$6(input, hint) { if (_typeof$8(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$8(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  function _typeof$8(obj) { "@babel/helpers - typeof"; return _typeof$8 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$8(obj); }
  var hasOwnProperty$1 = Object.prototype.hasOwnProperty;

  /**
  * Returns the camelCase counterpart of a symbol.
  * @private
  * @param {String} symbol The symbol.
  * @return the camelCase counterpart.
  */
  function toCamelCase(symbol) {
    return symbol.substring(0, 1).toLowerCase() + symbol.substring(1);
  }

  /**
   * A facade function that allows parameters to be passed either by name
   * (through an object), or by position (through an array).
   * @private
   * @param {Function} base The function that is being overriden. Will be
   *                        called with parameters in array-form.
   * @param {Object} defaults Parameter list and it's default values.
   * @param {*} params The parameters.
   */
  function namedParamFacade(base, defaults) {
    for (var _len = arguments.length, params = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      params[_key - 2] = arguments[_key];
    }
    if (params.length === 1 && _typeof$8(params[0]) === 'object' && !Array.isArray(params[0])) {
      var valid = Object.keys(params[0]).every(function (key) {
        return hasOwnProperty$1.call(defaults, key);
      });
      if (valid) {
        params = Object.keys(defaults).map(function (key) {
          return params[0][key] || defaults[key];
        });
      }
    }
    return base.apply(this, params);
  }

  /**
  * Qix schema definition.
  * @private
  */
  var Schema = /*#__PURE__*/function () {
    /**
    * Create a new schema instance.
    * @private
    * @param {Configuration} config The configuration for QIX.
    */
    function Schema(config) {
      _classCallCheck$6(this, Schema);
      this.config = config;
      this.Promise = config.Promise;
      this.schema = config.schema;
      this.mixins = new KeyValueCache();
      this.types = new KeyValueCache();
    }
    _createClass$6(Schema, [{
      key: "registerMixin",
      value: function registerMixin(_ref) {
        var _this = this;
        var types = _ref.types,
          type = _ref.type,
          extend = _ref.extend,
          override = _ref.override,
          init = _ref.init;
        if (!Array.isArray(types)) {
          types = [types];
        }
        // to support a single type
        if (type) {
          types.push(type);
        }
        var cached = {
          extend: extend,
          override: override,
          init: init
        };
        types.forEach(function (typeKey) {
          var entryList = _this.mixins.get(typeKey);
          if (entryList) {
            entryList.push(cached);
          } else {
            _this.mixins.add(typeKey, [cached]);
          }
        });
      }

      /**
      * Function used to generate a type definition.
      * @private
      * @param {String} type The type.
      * @returns {{create: Function, def: Object}} Returns an object with a definition
      *          of the type and a create factory.
      */
    }, {
      key: "generate",
      value: function generate(type) {
        var entry = this.types.get(type);
        if (entry) {
          return entry;
        }
        if (!this.schema.structs[type]) {
          throw createEnigmaError(errorCodes.SCHEMA_STRUCT_TYPE_NOT_FOUND, "".concat(type, " not found"));
        }
        var factory = this.generateApi(type, this.schema.structs[type]);
        this.types.add(type, factory);
        return factory;
      }

      /**
      * Function used to generate an API definition for a given type.
      * @private
      * @param {String} type The type to generate.
      * @param {Object} schema The schema describing the type.
      * @returns {{create: (function(session:Object, handle:Number, id:String,
      *          customKey:String)), def: Object}} Returns the API definition.
      */
    }, {
      key: "generateApi",
      value: function generateApi(type, schema) {
        var api = Object.create({});
        this.generateDefaultApi(api, schema); // Generate default
        this.mixinType(type, api); // Mixin default type
        this.mixinNamedParamFacade(api, schema); // Mixin named parameter support

        return function create(session, handle, id, customKey) {
          var _this2 = this;
          var instance = Object.create(api);
          Events.mixin(instance); // Always mixin event-emitter per instance

          Object.defineProperties(instance, {
            session: {
              enumerable: true,
              value: session
            },
            handle: {
              enumerable: true,
              value: handle,
              writable: true
            },
            id: {
              enumerable: true,
              value: id
            },
            type: {
              enumerable: true,
              value: type
            },
            genericType: {
              enumerable: true,
              value: customKey
            }
          });
          var mixinList = this.mixins.get(type) || [];
          if (customKey !== type) {
            this.mixinType(customKey, instance); // Mixin custom types
            mixinList = mixinList.concat(this.mixins.get(customKey) || []);
          }
          mixinList.forEach(function (mixin) {
            if (typeof mixin.init === 'function') {
              mixin.init({
                config: _this2.config,
                api: instance
              });
            }
          });
          return instance;
        }.bind(this);
      }

      /**
      * Function used to generate the methods with the right handlers to the object
      * API that is being generated.
      * @private
      * @param {Object} api The object API that is currently being generated.
      * @param {Object} schema The API definition.
      */
    }, {
      key: "generateDefaultApi",
      value: function generateDefaultApi(api, schema) {
        Object.keys(schema).forEach(function (method) {
          var out = schema[method].Out;
          var outKey = out.length === 1 ? out[0].Name : -1;
          var fnName = toCamelCase(method);
          api[fnName] = function generatedMethod() {
            for (var _len2 = arguments.length, params = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              params[_key2] = arguments[_key2];
            }
            return this.session.send({
              handle: this.handle,
              method: method,
              params: params,
              outKey: outKey
            });
          };
        });
      }

      /**
      * Function used to add mixin methods to a specified API.
      * @private
      * @param {String} type Used to specify which mixin should be woven in.
      * @param {Object} api The object that will be woven.
      */
    }, {
      key: "mixinType",
      value: function mixinType(type, api) {
        var mixinList = this.mixins.get(type);
        if (mixinList) {
          mixinList.forEach(function (_ref2) {
            var _ref2$extend = _ref2.extend,
              extend = _ref2$extend === void 0 ? {} : _ref2$extend,
              _ref2$override = _ref2.override,
              override = _ref2$override === void 0 ? {} : _ref2$override;
            Object.keys(override).forEach(function (key) {
              if (typeof api[key] === 'function' && typeof override[key] === 'function') {
                var baseFn = api[key];
                api[key] = function wrappedFn() {
                  for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                    args[_key3] = arguments[_key3];
                  }
                  return override[key].apply(this, [baseFn.bind(this)].concat(args));
                };
              } else {
                throw createEnigmaError(errorCodes.SCHEMA_MIXIN_CANT_OVERRIDE_FUNCTION, "No function to override. Type: ".concat(type, " function: ").concat(key));
              }
            });
            Object.keys(extend).forEach(function (key) {
              // handle overrides
              if (typeof api[key] === 'function' && typeof extend[key] === 'function') {
                throw createEnigmaError(errorCodes.SCHEMA_MIXIN_EXTEND_NOT_ALLOWED, "Extend is not allowed for this mixin. Type: ".concat(type, " function: ").concat(key));
              } else {
                api[key] = extend[key];
              }
            });
          });
        }
      }

      /**
      * Function used to mixin the named parameter facade.
      * @private
      * @param {Object} api The object API that is currently being generated.
      * @param {Object} schema The API definition.
      */
    }, {
      key: "mixinNamedParamFacade",
      value: function mixinNamedParamFacade(api, schema) {
        Object.keys(schema).forEach(function (key) {
          var fnName = toCamelCase(key);
          var base = api[fnName];
          var defaults = schema[key].In.reduce(function (result, item) {
            result[item.Name] = item.DefaultValue;
            return result;
          }, {});
          api[fnName] = function namedParamWrapper() {
            for (var _len4 = arguments.length, params = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
              params[_key4] = arguments[_key4];
            }
            return namedParamFacade.apply(this, [base, defaults].concat(params));
          };
        });
      }
    }]);
    return Schema;
  }();

  function _typeof$7(obj) { "@babel/helpers - typeof"; return _typeof$7 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$7(obj); }
  function _classCallCheck$5(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$5(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$5(descriptor.key), descriptor); } }
  function _createClass$5(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$5(Constructor.prototype, protoProps); if (staticProps) _defineProperties$5(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$5(arg) { var key = _toPrimitive$5(arg, "string"); return _typeof$7(key) === "symbol" ? key : String(key); }
  function _toPrimitive$5(input, hint) { if (_typeof$7(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$7(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

  /**
   * Helper class for handling RPC calls
   * @private
   */
  var RPCResolver = /*#__PURE__*/function () {
    function RPCResolver(id, handle, resolve, reject) {
      _classCallCheck$5(this, RPCResolver);
      Events.mixin(this);
      this.id = id;
      this.handle = handle;
      this.resolve = resolve;
      this.reject = reject;
    }
    _createClass$5(RPCResolver, [{
      key: "resolveWith",
      value: function resolveWith(data) {
        this.resolve(data);
        this.emit('resolved', this.id);
      }
    }, {
      key: "rejectWith",
      value: function rejectWith(err) {
        this.reject(err);
        this.emit('rejected', this.id);
      }
    }]);
    return RPCResolver;
  }();

  function _typeof$6(obj) { "@babel/helpers - typeof"; return _typeof$6 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$6(obj); }
  function _classCallCheck$4(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$4(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$4(descriptor.key), descriptor); } }
  function _createClass$4(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$4(Constructor.prototype, protoProps); if (staticProps) _defineProperties$4(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$4(arg) { var key = _toPrimitive$4(arg, "string"); return _typeof$6(key) === "symbol" ? key : String(key); }
  function _toPrimitive$4(input, hint) { if (_typeof$6(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$6(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

  /**
  * This class handles remote procedure calls on a web socket.
  * @private
  */
  var RPC = /*#__PURE__*/function () {
    /**
    * Create a new RPC instance.
    * @private
    * @param {Object} options The configuration options for this class.
    * @param {Function} options.Promise The promise constructor to use.
    * @param {String} options.url The complete websocket URL used to connect.
    * @param {Function} options.createSocket The function callback to create a WebSocket.
    */
    function RPC(options) {
      _classCallCheck$4(this, RPC);
      Object.assign(this, options);
      Events.mixin(this);
      this.resolvers = {};
      this.requestId = 0;
      this.openedPromise = undefined;
      this.closeEvent = undefined;
    }

    /**
    * Opens a connection to the configured endpoint.
    * @private
    * @param {Boolean} force - ignores all previous and outstanding open calls if set to true.
    * @returns {Object} A promise instance.
    */
    _createClass$4(RPC, [{
      key: "open",
      value: function open() {
        var _this = this;
        var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        if (!force && this.openedPromise) {
          return this.openedPromise;
        }
        try {
          this.socket = this.createSocket(this.url);
        } catch (err) {
          return this.Promise.reject(err);
        }
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onclose = this.onClose.bind(this);
        this.socket.onerror = this.onError.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.openedPromise = new this.Promise(function (resolve, reject) {
          return _this.registerResolver('opened', null, resolve, reject);
        });
        this.closedPromise = new this.Promise(function (resolve, reject) {
          return _this.registerResolver('closed', null, resolve, reject);
        });
        return this.openedPromise;
      }

      /**
      * Resolves the open promise when a connection is successfully established.
      * @private
      */
    }, {
      key: "onOpen",
      value: function onOpen() {
        var _this2 = this;
        this.resolvers.opened.resolveWith(function () {
          return _this2.closedPromise;
        });
      }

      /**
      * Resolves the close promise when a connection is closed.
      * @private
      * @param {Object} event - The event describing close.
      */
    }, {
      key: "onClose",
      value: function onClose(event) {
        this.emit('closed', event);
        this.closeEvent = event;
        if (this.resolvers && this.resolvers.closed) {
          this.resolvers.closed.resolveWith(event);
        }
        this.rejectAllOutstandingResolvers(createEnigmaError(errorCodes.NOT_CONNECTED, 'Socket closed', event));
      }

      /**
      * Closes a connection.
      * @private
      * @param {Number} [code=1000] - The reason code for closing the connection.
      * @param {String} [reason=""] - The human readable string describing why the connection is closed.
      * @returns {Object} Returns a promise instance.
      */
    }, {
      key: "close",
      value: function close() {
        var code = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1000;
        var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        if (this.socket) {
          this.socket.close(code, reason);
          this.socket = null;
        }
        return this.closedPromise;
      }

      /**
      * Emits an error event and rejects the open promise if an error is raised on the connection.
      * @private
      * @param {Object} event - The event describing the error.
      */
    }, {
      key: "onError",
      value: function onError(event) {
        if (this.resolvers.opened) {
          this.resolvers.opened.rejectWith(event);
        } else {
          // only emit errors after the initial open promise has been resolved,
          // this makes it possible to catch early websocket errors as well
          // as run-time ones:
          this.emit('socket-error', event);
        }
        this.rejectAllOutstandingResolvers(createEnigmaError(errorCodes.NOT_CONNECTED, 'Socket error', event));
      }

      /**
      * Parses the onMessage event on the connection and resolve the promise for the request.
      * @private
      * @param {Object} event - The event describing the message.
      */
    }, {
      key: "onMessage",
      value: function onMessage(event) {
        var data = JSON.parse(event.data);
        var resolver = this.resolvers[data.id] || {};
        this.emit('traffic', 'received', data, resolver.handle);
        if (typeof data.id !== 'undefined' && this.resolvers[data.id]) {
          this.emit('message', data);
          this.resolvers[data.id].resolveWith(data);
        } else {
          this.emit(data.params ? 'notification' : 'message', data);
        }
      }

      /**
      * Rejects all outstanding resolvers.
      * @private
      * @param {Object} reason - The reject reason.
      */
    }, {
      key: "rejectAllOutstandingResolvers",
      value: function rejectAllOutstandingResolvers(reason) {
        var _this3 = this;
        Object.keys(this.resolvers).forEach(function (id) {
          if (id === 'opened' || id === 'closed') {
            return; // "opened" and "closed" should not be handled here
          }

          var resolver = _this3.resolvers[id];
          resolver.rejectWith(reason);
        });
      }

      /**
      * Unregisters a resolver.
      * @private
      * @param {Number|String} id - The ID to unregister the resolver with.
      */
    }, {
      key: "unregisterResolver",
      value: function unregisterResolver(id) {
        var resolver = this.resolvers[id];
        resolver.removeAllListeners();
        delete this.resolvers[id];
      }

      /**
      * Registers a resolver.
      * @private
      * @param {Number|String} id - The ID to register the resolver with.
      * @param {Number} handle - The associated handle.
      * @returns {Function} The promise executor function.
      */
    }, {
      key: "registerResolver",
      value: function registerResolver(id, handle, resolve, reject) {
        var _this4 = this;
        var resolver = new RPCResolver(id, handle, resolve, reject);
        this.resolvers[id] = resolver;
        resolver.on('resolved', function (resolvedId) {
          return _this4.unregisterResolver(resolvedId);
        });
        resolver.on('rejected', function (rejectedId) {
          return _this4.unregisterResolver(rejectedId);
        });
      }

      /**
      * Sends data on the socket.
      * @private
      * @param {Object} data - The data to send.
      * @returns {Object} A promise instance.
      */
    }, {
      key: "send",
      value: function send(data) {
        var _this5 = this;
        if (!this.socket || this.socket.readyState !== this.socket.OPEN) {
          var error = createEnigmaError(errorCodes.NOT_CONNECTED, 'Not connected', this.closeEvent);
          return this.Promise.reject(error);
        }
        if (!data.id) {
          data.id = this.createRequestId();
        }
        data.jsonrpc = '2.0';
        return new this.Promise(function (resolve, reject) {
          _this5.socket.send(JSON.stringify(data));
          _this5.emit('traffic', 'sent', data, data.handle);
          return _this5.registerResolver(data.id, data.handle, resolve, reject);
        });
      }
    }, {
      key: "createRequestId",
      value: function createRequestId() {
        this.requestId += 1;
        return this.requestId;
      }
    }]);
    return RPC;
  }();

  function _typeof$5(obj) { "@babel/helpers - typeof"; return _typeof$5 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$5(obj); }
  function _classCallCheck$3(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$3(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$3(descriptor.key), descriptor); } }
  function _createClass$3(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$3(Constructor.prototype, protoProps); if (staticProps) _defineProperties$3(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$3(arg) { var key = _toPrimitive$3(arg, "string"); return _typeof$5(key) === "symbol" ? key : String(key); }
  function _toPrimitive$3(input, hint) { if (_typeof$5(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$5(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  var ON_ATTACHED_TIMEOUT_MS = 5000;
  var RPC_CLOSE_MANUAL_SUSPEND = 4000;
  var SuspendResume = /*#__PURE__*/function () {
    /**
    * Creates a new SuspendResume instance.
    * @private
    * @param {Object} options The configuration option for this class.
    * @param {Promise<Object>} options.Promise The promise constructor to use.
    * @param {RPC} options.rpc The RPC instance to use when communicating towards Engine.
    * @param {ApiCache} options.apis The ApiCache instance to use.
    */
    function SuspendResume(options) {
      var _this = this;
      _classCallCheck$3(this, SuspendResume);
      Object.assign(this, options);
      this.isSuspended = false;
      this.rpc.on('traffic', function (dir, data) {
        if (dir === 'sent' && data.method === 'OpenDoc') {
          _this.openDocParams = data.params;
        }
      });
    }

    /**
    * Function used to restore the rpc connection.
    * @private
    * @param {Boolean} onlyIfAttached - if true, the returned promise will resolve
    *                                   only if the session can be re-attached.
    * @returns {Object} Returns a promise instance.
    */
    _createClass$3(SuspendResume, [{
      key: "restoreRpcConnection",
      value: function restoreRpcConnection(onlyIfAttached) {
        var _this2 = this;
        return this.reopen(ON_ATTACHED_TIMEOUT_MS).then(function (sessionState) {
          if (sessionState === 'SESSION_CREATED' && onlyIfAttached) {
            return _this2.Promise.reject(createEnigmaError(errorCodes.SESSION_NOT_ATTACHED, 'Not attached'));
          }
          return _this2.Promise.resolve();
        });
      }

      /**
      * Function used to restore the global API.
      * @private
      * @param {Object} changed - A list where the restored APIs will be added.
      * @returns {Object} Returns a promise instance.
      */
    }, {
      key: "restoreGlobal",
      value: function restoreGlobal(changed) {
        var global = this.apis.getApisByType('Global').pop();
        changed.push(global.api);
        return this.Promise.resolve();
      }

      /**
      * Function used to restore the doc API.
      * @private
      * @param {String} sessionState - The state of the session, attached or created.
      * @param {Array} closed - A list where the closed of APIs APIs will be added.
      * @param {Object} changed - A list where the restored APIs will be added.
      * @returns {Object} Returns a promise instance.
      */
    }, {
      key: "restoreDoc",
      value: function restoreDoc(closed, changed) {
        var _this3 = this;
        var doc = this.apis.getApisByType('Doc').pop();
        if (!doc) {
          return this.Promise.resolve();
        }
        return this.rpc.send({
          method: 'GetActiveDoc',
          handle: -1,
          params: []
        }).then(function (response) {
          if (response.error && _this3.openDocParams) {
            return _this3.rpc.send({
              method: 'OpenDoc',
              handle: -1,
              params: _this3.openDocParams
            });
          }
          return response;
        }).then(function (response) {
          if (response.error) {
            closed.push(doc.api);
            return _this3.Promise.resolve();
          }
          var handle = response.result.qReturn.qHandle;
          doc.api.handle = handle;
          changed.push(doc.api);
          return _this3.Promise.resolve(doc.api);
        });
      }

      /**
      * Function used to restore the APIs on the doc.
      * @private
      * @param {Object} doc - The doc API on which the APIs we want to restore exist.
      * @param {Array} closed - A list where the closed of APIs APIs will be added.
      * @param {Object} changed - A list where the restored APIs will be added.
      * @returns {Object} Returns a promise instance.
      */
    }, {
      key: "restoreDocObjects",
      value: function restoreDocObjects(doc, closed, changed) {
        var _this4 = this;
        var tasks = [];
        var apis = this.apis.getApis().map(function (entry) {
          return entry.api;
        }).filter(function (api) {
          return api.type !== 'Global' && api.type !== 'Doc';
        });
        if (!doc) {
          apis.forEach(function (api) {
            return closed.push(api);
          });
          return this.Promise.resolve();
        }
        apis.forEach(function (api) {
          var method = SuspendResume.buildGetMethodName(api.type);
          if (!method) {
            closed.push(api);
          } else {
            var request = _this4.rpc.send({
              method: method,
              handle: doc.handle,
              params: [api.id]
            }).then(function (response) {
              if (response.error || !response.result.qReturn.qHandle) {
                closed.push(api);
              } else {
                api.handle = response.result.qReturn.qHandle;
                changed.push(api);
              }
            });
            tasks.push(request);
          }
        });
        return this.Promise.all(tasks);
      }

      /**
      * Set the instance as suspended.
      * @private
      * @param {Number} [code=4000] - The reason code for suspending the connection.
      * @param {String} [reason=""] - The human readable string describing
      * why the connection is suspended.
      */
    }, {
      key: "suspend",
      value: function suspend() {
        var code = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : RPC_CLOSE_MANUAL_SUSPEND;
        var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        this.isSuspended = true;
        return this.rpc.close(code, reason);
      }

      /**
      * Resumes a previously suspended RPC connection, and refreshes the API cache.
      *                                APIs unabled to be restored has their 'closed'
      *                                event triggered, otherwise 'changed'.
      * @private
      * @emits API#changed
      * @emits APIfunction@#closed
      * @param {Boolean} onlyIfAttached if true, resume only if the session was re-attached.
      * @returns {Promise<Object>} Eventually resolved if the RPC connection was successfully resumed,
      *                    otherwise rejected.
      */
    }, {
      key: "resume",
      value: function resume(onlyIfAttached) {
        var _this5 = this;
        var changed = [];
        var closed = [];
        return this.restoreRpcConnection(onlyIfAttached).then(function () {
          return _this5.restoreGlobal(changed);
        }).then(function () {
          return _this5.restoreDoc(closed, changed);
        }).then(function (doc) {
          return _this5.restoreDocObjects(doc, closed, changed);
        }).then(function () {
          _this5.isSuspended = false;
          _this5.apis.clear();
          closed.forEach(function (api) {
            api.emit('closed');
            api.removeAllListeners();
          });
          changed.forEach(function (api) {
            _this5.apis.add(api.handle, api);
            if (api.type !== 'Global') {
              api.emit('changed');
            }
          });
        })["catch"](function (err) {
          return _this5.rpc.close().then(function () {
            return _this5.Promise.reject(err);
          });
        });
      }

      /**
      * Reopens the connection and waits for the OnConnected notification.
      * @private
      * @param {Number} timeout - The time to wait for the OnConnected notification.
      * @returns {Object} A promise containing the session state (SESSION_CREATED or SESSION_ATTACHED).
      */
    }, {
      key: "reopen",
      value: function reopen(timeout) {
        var _this6 = this;
        var timer;
        var notificationResolve;
        var notificationReceived = false;
        var notificationPromise = new this.Promise(function (resolve) {
          notificationResolve = resolve;
        });
        var waitForNotification = function waitForNotification() {
          if (!notificationReceived) {
            timer = setTimeout(function () {
              return notificationResolve('SESSION_CREATED');
            }, timeout);
          }
          return notificationPromise;
        };
        var onNotification = function onNotification(data) {
          if (data.method !== 'OnConnected') return;
          clearTimeout(timer);
          notificationResolve(data.params.qSessionState);
          notificationReceived = true;
        };
        this.rpc.on('notification', onNotification);
        return this.rpc.open(true).then(waitForNotification).then(function (state) {
          _this6.rpc.removeListener('notification', onNotification);
          return state;
        })["catch"](function (err) {
          _this6.rpc.removeListener('notification', onNotification);
          return _this6.Promise.reject(err);
        });
      }

      /**
      * Function used to build the get method names for Doc APIs.
      * @private
      * @param {String} type - The API type.
      * @returns {String} Returns the get method name, or undefined if the type cannot be restored.
      */
    }], [{
      key: "buildGetMethodName",
      value: function buildGetMethodName(type) {
        if (type === 'Field' || type === 'Variable') {
          return null;
        }
        if (type === 'GenericVariable') {
          return 'GetVariableById';
        }
        return type.replace('Generic', 'Get');
      }
    }]);
    return SuspendResume;
  }();

  var SUCCESS_KEY = 'qSuccess';
  function deltaRequestInterceptor(session, request) {
    var delta = session.config.protocol.delta && request.outKey !== -1 && request.outKey !== SUCCESS_KEY;
    if (delta) {
      request.delta = delta;
    }
    return request;
  }

  /**
  * Response interceptor for generating APIs. Handles the quirks of engine not
  * returning an error when an object is missing.
  * @private
  * @param {Session} session - The session the intercept is being executed on.
  * @param {Object} request - The JSON-RPC request.
  * @param {Object} response - The response.
  * @returns {Object} - Returns the generated API
  */
  function apiResponseInterceptor(session, request, response) {
    if (response && response.qHandle && response.qType) {
      return session.getObjectApi({
        handle: response.qHandle,
        type: response.qType,
        id: response.qGenericId,
        genericType: response.qGenericType
      });
    }
    if (response && response.qHandle === null && response.qType === null) {
      var error = createEnigmaError(errorCodes.OBJECT_NOT_FOUND, 'Object not found');
      return session.config.Promise.reject(error);
    }
    return response;
  }

  var hasOwn = Object.prototype.hasOwnProperty;
  var toStr = Object.prototype.toString;
  var defineProperty = Object.defineProperty;
  var gOPD = Object.getOwnPropertyDescriptor;

  var isArray$1 = function isArray(arr) {
  	if (typeof Array.isArray === 'function') {
  		return Array.isArray(arr);
  	}

  	return toStr.call(arr) === '[object Array]';
  };

  var isPlainObject = function isPlainObject(obj) {
  	if (!obj || toStr.call(obj) !== '[object Object]') {
  		return false;
  	}

  	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
  	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
  	// Not own constructor property must be Object
  	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
  		return false;
  	}

  	// Own properties are enumerated firstly, so to speed up,
  	// if last one is own, then all properties are own.
  	var key;
  	for (key in obj) { /**/ }

  	return typeof key === 'undefined' || hasOwn.call(obj, key);
  };

  // If name is '__proto__', and Object.defineProperty is available, define __proto__ as an own property on target
  var setProperty = function setProperty(target, options) {
  	if (defineProperty && options.name === '__proto__') {
  		defineProperty(target, options.name, {
  			enumerable: true,
  			configurable: true,
  			value: options.newValue,
  			writable: true
  		});
  	} else {
  		target[options.name] = options.newValue;
  	}
  };

  // Return undefined instead of __proto__ if '__proto__' is not an own property
  var getProperty = function getProperty(obj, name) {
  	if (name === '__proto__') {
  		if (!hasOwn.call(obj, name)) {
  			return void 0;
  		} else if (gOPD) {
  			// In early versions of node, obj['__proto__'] is buggy when obj has
  			// __proto__ as an own property. Object.getOwnPropertyDescriptor() works.
  			return gOPD(obj, name).value;
  		}
  	}

  	return obj[name];
  };

  var extend$1 = function extend() {
  	var options, name, src, copy, copyIsArray, clone;
  	var target = arguments[0];
  	var i = 1;
  	var length = arguments.length;
  	var deep = false;

  	// Handle a deep copy situation
  	if (typeof target === 'boolean') {
  		deep = target;
  		target = arguments[1] || {};
  		// skip the boolean and the target
  		i = 2;
  	}
  	if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
  		target = {};
  	}

  	for (; i < length; ++i) {
  		options = arguments[i];
  		// Only deal with non-null/undefined values
  		if (options != null) {
  			// Extend the base object
  			for (name in options) {
  				src = getProperty(target, name);
  				copy = getProperty(options, name);

  				// Prevent never-ending loop
  				if (target !== copy) {
  					// Recurse if we're merging plain objects or arrays
  					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray$1(copy)))) {
  						if (copyIsArray) {
  							copyIsArray = false;
  							clone = src && isArray$1(src) ? src : [];
  						} else {
  							clone = src && isPlainObject(src) ? src : {};
  						}

  						// Never move original objects, clone them
  						setProperty(target, { name: name, newValue: extend(deep, clone, copy) });

  					// Don't bring in undefined values
  					} else if (typeof copy !== 'undefined') {
  						setProperty(target, { name: name, newValue: copy });
  					}
  				}
  			}
  		}
  	}

  	// Return the modified object
  	return target;
  };

  function _toConsumableArray$1(arr) { return _arrayWithoutHoles$1(arr) || _iterableToArray$1(arr) || _unsupportedIterableToArray$1(arr) || _nonIterableSpread$1(); }
  function _nonIterableSpread$1() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
  function _unsupportedIterableToArray$1(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$1(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen); }
  function _iterableToArray$1(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
  function _arrayWithoutHoles$1(arr) { if (Array.isArray(arr)) return _arrayLikeToArray$1(arr); }
  function _arrayLikeToArray$1(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
  function _typeof$4(obj) { "@babel/helpers - typeof"; return _typeof$4 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$4(obj); }
  var extend = extend$1.bind(null, true);
  var JSONPatch = {};
  var isArray = Array.isArray;
  function isObject(v) {
    return v != null && !Array.isArray(v) && _typeof$4(v) === 'object';
  }
  function isUndef(v) {
    return typeof v === 'undefined';
  }
  function isFunction(v) {
    return typeof v === 'function';
  }

  /**
  * Generate an exact duplicate (with no references) of a specific value.
  *
  * @private
  * @param {Object} The value to duplicate
  * @returns {Object} a unique, duplicated value
  */
  function generateValue(val) {
    if (val) {
      return extend({}, {
        val: val
      }).val;
    }
    return val;
  }

  /**
  * An additional type checker used to determine if the property is of internal
  * use or not a type that can be translated into JSON (like functions).
  *
  * @private
  * @param {Object} obj The object which has the property to check
  * @param {String} The property name to check
  * @returns {Boolean} Whether the property is deemed special or not
  */
  function isSpecialProperty(obj, key) {
    return isFunction(obj[key]) || key.substring(0, 2) === '$$' || key.substring(0, 1) === '_';
  }

  /**
  * Finds the parent object from a JSON-Pointer ("/foo/bar/baz" = "bar" is "baz" parent),
  * also creates the object structure needed.
  *
  * @private
  * @param {Object} data The root object to traverse through
  * @param {String} The JSON-Pointer string to use when traversing
  * @returns {Object} The parent object
  */
  function getParent(data, str) {
    var seperator = '/';
    var parts = str.substring(1).split(seperator).slice(0, -1);
    var numPart;
    parts.forEach(function (part, i) {
      if (i === parts.length) {
        return;
      }
      numPart = +part;
      var newPart = !isNaN(numPart) ? [] : {};
      data[numPart || part] = isUndef(data[numPart || part]) ? newPart : data[part];
      data = data[numPart || part];
    });
    return data;
  }

  /**
  * Cleans an object of all its properties, unless they're deemed special or
  * cannot be removed by configuration.
  *
  * @private
  * @param {Object} obj The object to clean
  */
  function emptyObject(obj) {
    Object.keys(obj).forEach(function (key) {
      var config = Object.getOwnPropertyDescriptor(obj, key);
      if (config.configurable && !isSpecialProperty(obj, key)) {
        delete obj[key];
      }
    });
  }

  /**
  * Compare an object with another, could be object, array, number, string, bool.
  * @private
  * @param {Object} a The first object to compare
  * @param {Object} a The second object to compare
  * @returns {Boolean} Whether the objects are identical
  */
  function compare(a, b) {
    var isIdentical = true;
    if (isObject(a) && isObject(b)) {
      if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
      }
      Object.keys(a).forEach(function (key) {
        if (!compare(a[key], b[key])) {
          isIdentical = false;
        }
      });
      return isIdentical;
    }
    if (isArray(a) && isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (var i = 0, l = a.length; i < l; i += 1) {
        if (!compare(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    return a === b;
  }

  /**
  * Generates patches by comparing two arrays.
  *
  * @private
  * @param {Array} oldA The old (original) array, which will be patched
  * @param {Array} newA The new array, which will be used to compare against
  * @returns {Array} An array of patches (if any)
  */
  function patchArray(original, newA, basePath) {
    var patches = [];
    var oldA = original.slice();
    var tmpIdx = -1;
    function findIndex(a, id, idx) {
      if (a[idx] && isUndef(a[idx].qInfo)) {
        return null;
      }
      if (a[idx] && a[idx].qInfo.qId === id) {
        // shortcut if identical
        return idx;
      }
      for (var ii = 0, ll = a.length; ii < ll; ii += 1) {
        if (a[ii] && a[ii].qInfo.qId === id) {
          return ii;
        }
      }
      return -1;
    }
    if (compare(newA, oldA)) {
      // array is unchanged
      return patches;
    }
    if (!isUndef(newA[0]) && isUndef(newA[0].qInfo)) {
      // we cannot create patches without unique identifiers, replace array...
      patches.push({
        op: 'replace',
        path: basePath,
        value: newA
      });
      return patches;
    }
    for (var i = oldA.length - 1; i >= 0; i -= 1) {
      tmpIdx = findIndex(newA, oldA[i].qInfo && oldA[i].qInfo.qId, i);
      if (tmpIdx === -1) {
        patches.push({
          op: 'remove',
          path: "".concat(basePath, "/").concat(i)
        });
        oldA.splice(i, 1);
      } else {
        patches = patches.concat(JSONPatch.generate(oldA[i], newA[tmpIdx], "".concat(basePath, "/").concat(i)));
      }
    }
    for (var _i = 0, l = newA.length; _i < l; _i += 1) {
      tmpIdx = findIndex(oldA, newA[_i].qInfo && newA[_i].qInfo.qId);
      if (tmpIdx === -1) {
        patches.push({
          op: 'add',
          path: "".concat(basePath, "/").concat(_i),
          value: newA[_i]
        });
        oldA.splice(_i, 0, newA[_i]);
      } else if (tmpIdx !== _i) {
        patches.push({
          op: 'move',
          path: "".concat(basePath, "/").concat(_i),
          from: "".concat(basePath, "/").concat(tmpIdx)
        });
        oldA.splice(_i, 0, oldA.splice(tmpIdx, 1)[0]);
      }
    }
    return patches;
  }

  /**
  * Generate an array of JSON-Patch:es following the JSON-Patch Specification Draft.
  *
  * See [specification draft](http://tools.ietf.org/html/draft-ietf-appsawg-json-patch-10)
  *
  * Does NOT currently generate patches for arrays (will replace them)
  * @private
  * @param {Object} original The object to patch to
  * @param {Object} newData The object to patch from
  * @param {String} [basePath] The base path to use when generating the paths for
  *                            the patches (normally not used)
  * @returns {Array} An array of patches
  */
  JSONPatch.generate = function generate(original, newData, basePath) {
    basePath = basePath || '';
    var patches = [];
    Object.keys(newData).forEach(function (key) {
      var val = generateValue(newData[key]);
      var oldVal = original[key];
      var tmpPath = "".concat(basePath, "/").concat(key);
      if (compare(val, oldVal) || isSpecialProperty(newData, key)) {
        return;
      }
      if (isUndef(oldVal)) {
        // property does not previously exist
        patches.push({
          op: 'add',
          path: tmpPath,
          value: val
        });
      } else if (isObject(val) && isObject(oldVal)) {
        // we need to generate sub-patches for this, since it already exist
        patches = patches.concat(JSONPatch.generate(oldVal, val, tmpPath));
      } else if (isArray(val) && isArray(oldVal)) {
        patches = patches.concat(patchArray(oldVal, val, tmpPath));
      } else {
        // it's a simple property (bool, string, number)
        patches.push({
          op: 'replace',
          path: "".concat(basePath, "/").concat(key),
          value: val
        });
      }
    });
    Object.keys(original).forEach(function (key) {
      if (isUndef(newData[key]) && !isSpecialProperty(original, key)) {
        // this property does not exist anymore
        patches.push({
          op: 'remove',
          path: "".concat(basePath, "/").concat(key)
        });
      }
    });
    return patches;
  };

  /**
  * Apply a list of patches to an object.
  * @private
  * @param {Object} original The object to patch
  * @param {Array} patches The list of patches to apply
  */
  JSONPatch.apply = function apply(original, patches) {
    patches.forEach(function (patch) {
      var parent = getParent(original, patch.path);
      var key = patch.path.split('/').splice(-1)[0];
      var target = key && isNaN(+key) ? parent[key] : parent[+key] || parent;
      var from = patch.from ? patch.from.split('/').splice(-1)[0] : null;
      if (patch.path === '/') {
        parent = null;
        target = original;
      }
      if (patch.op === 'add' || patch.op === 'replace') {
        if (isArray(parent)) {
          // trust indexes from patches, so don't replace the index if it's an add
          if (key === '-') {
            key = parent.length;
          }
          parent.splice(+key, patch.op === 'add' ? 0 : 1, patch.value);
        } else if (isArray(target) && isArray(patch.value)) {
          // keep array reference if possible...
          target.length = 0;
          var chunkSize = 1000;
          for (var i = 0; i < patch.value.length; i += chunkSize) {
            var _target;
            var chunk = patch.value.slice(i, i + chunkSize);
            (_target = target).push.apply(_target, _toConsumableArray$1(chunk));
          }
        } else if (isObject(target) && isObject(patch.value)) {
          // keep object reference if possible...
          emptyObject(target);
          extend(target, patch.value);
        } else if (!parent) {
          throw createEnigmaError(errorCodes.PATCH_HAS_NO_PARENT, 'Patchee is not an object we can patch');
        } else {
          // simple value
          parent[key] = patch.value;
        }
      } else if (patch.op === 'move') {
        var oldParent = getParent(original, patch.from);
        if (isArray(parent)) {
          parent.splice(+key, 0, oldParent.splice(+from, 1)[0]);
        } else {
          parent[key] = oldParent[from];
          delete oldParent[from];
        }
      } else if (patch.op === 'remove') {
        if (isArray(parent)) {
          parent.splice(+key, 1);
        } else {
          delete parent[key];
        }
      }
    });
  };

  /**
  * Deep clone an object.
  * @private
  * @param {Object} obj The object to clone
  * @returns {Object} A new object identical to the `obj`
  */
  JSONPatch.clone = function clone(obj) {
    return extend({}, obj);
  };

  /**
  * Creates a JSON-patch.
  * @private
  * @param {String} op The operation of the patch. Available values: "add", "remove", "move"
  * @param {Object} [val] The value to set the `path` to. If `op` is `move`, `val`
  *                       is the "from JSON-path" path
  * @param {String} path The JSON-path for the property to change (e.g. "/qHyperCubeDef/columnOrder")
  * @returns {Object} A patch following the JSON-patch specification
  */
  JSONPatch.createPatch = function createPatch(op, val, path) {
    var patch = {
      op: op.toLowerCase(),
      path: path
    };
    if (patch.op === 'move') {
      patch.from = val;
    } else if (typeof val !== 'undefined') {
      patch.value = val;
    }
    return patch;
  };

  /**
  * Apply the differences of two objects (keeping references if possible).
  * Identical to running `JSONPatch.apply(original, JSONPatch.generate(original, newData));`
  * @private
  * @param {Object} original The object to update/patch
  * @param {Object} newData the object to diff against
  *
  * @example
  * var obj1 = { foo: [1,2,3], bar: { baz: true, qux: 1 } };
  * var obj2 = { foo: [4,5,6], bar: { baz: false } };
  * JSONPatch.updateObject(obj1, obj2);
  * // => { foo: [4,5,6], bar: { baz: false } };
  */
  JSONPatch.updateObject = function updateObject(original, newData) {
    if (!Object.keys(original).length) {
      extend(original, newData);
      return;
    }
    JSONPatch.apply(original, JSONPatch.generate(original, newData));
  };

  function _typeof$3(obj) { "@babel/helpers - typeof"; return _typeof$3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$3(obj); }
  var sessions = {};

  /**
  * Function to make sure we release handle caches when they are closed.
  * @private
  * @param {Session} session The session instance to listen on.
  */
  var bindSession = function bindSession(session) {
    if (!sessions[session.id]) {
      var cache = {};
      sessions[session.id] = cache;
      session.on('traffic:received', function (data) {
        return data.close && data.close.forEach(function (handle) {
          return delete cache[handle];
        });
      });
      session.on('closed', function () {
        return delete sessions[session.id];
      });
    }
  };

  /**
  * Simple function that ensures the session events has been bound, and returns
  * either an existing key-value cache or creates one for the specified handle.
  * @private
  * @param {Session} session The session that owns the handle.
  * @param {Number} handle The object handle to retrieve the cache for.
  * @returns {KeyValueCache} The cache instance.
  */
  var getHandleCache = function getHandleCache(session, handle) {
    bindSession(session);
    var cache = sessions[session.id];
    if (!cache[handle]) {
      cache[handle] = new KeyValueCache();
    }
    return cache[handle];
  };

  /**
  * Function used to apply a list of patches and return the patched value.
  * @private
  * @param {Session} session The session.
  * @param {Number} handle The object handle.
  * @param {String} cacheId The cacheId.
  * @param {Array} patches The patches.
  * @returns {Object} Returns the patched value.
  */
  var patchValue = function patchValue(session, handle, cacheId, patches) {
    var cache = getHandleCache(session, handle);
    var entry = cache.get(cacheId);
    if (typeof entry === 'undefined') {
      entry = Array.isArray(patches[0].value) ? [] : {};
    }
    if (patches.length) {
      if (patches[0].path === '/' && _typeof$3(patches[0].value) !== 'object') {
        // 'plain' values on root path is not supported (no object reference),
        // so we simply store the value directly:
        entry = patches[0].value;
      } else {
        JSONPatch.apply(entry, patches);
      }
      cache.set(cacheId, entry);
    }
    return entry;
  };

  /**
  * Process delta interceptor.
  * @private
  * @param {Session} session The session the intercept is being executed on.
  * @param {Object} request The JSON-RPC request.
  * @param {Object} response The response.
  * @returns {Object} Returns the patched response
  */
  function deltaResponseInterceptor(session, request, response) {
    var delta = response.delta,
      result = response.result;
    if (delta) {
      // when delta is on the response data is expected to be an array of patches:
      Object.keys(result).forEach(function (key) {
        if (!Array.isArray(result[key])) {
          throw createEnigmaError(errorCodes.EXPECTED_ARRAY_OF_PATCHES, 'Unexpected RPC response, expected array of patches');
        }
        result[key] = patchValue(session, request.handle, "".concat(request.method, "-").concat(key), result[key]);
      });
      // return a cloned response object to avoid patched object references:
      return JSON.parse(JSON.stringify(response));
    }
    return response;
  }

  // export object reference for testing purposes:
  deltaResponseInterceptor.sessions = sessions;

  /**
  * Process error interceptor.
  * @private
  * @param {Session} session - The session the intercept is being executed on.
  * @param {Object} request - The JSON-RPC request.
  * @param {Object} response - The response.
  * @returns {Object} - Returns the defined error for an error, else the response.
  */
  function errorResponseInterceptor(session, request, response) {
    if (typeof response.error !== 'undefined') {
      var data = response.error;
      var error = new Error(data.message);
      error.code = data.code;
      error.parameter = data.parameter;
      return session.config.Promise.reject(error);
    }
    return response;
  }

  var RETURN_KEY = 'qReturn';

  /**
  * Picks out the result "out" parameter based on the QIX method+schema, with
  * some specific handling for some methods that breaks the predictable protocol.
  * @private
  * @param {Session} session - The session the intercept is being executed on.
  * @param {Object} request - The JSON-RPC request.
  * @param {Object} response - The response.
  * @returns {Object} - Returns the result property on the response
  */
  function outParamResponseInterceptor(session, request, response) {
    if (request.method === 'CreateSessionApp' || request.method === 'CreateSessionAppFromApp') {
      // this method returns multiple out params that we need
      // to normalize before processing the response further:
      response[RETURN_KEY].qGenericId = response.qSessionAppId || response[RETURN_KEY].qGenericId;
    } else if (request.method === 'GetInteract' || request.method === 'StoreTempSelectionState' || request.method === 'CreateTemporaryBookmark') {
      // this method returns a qReturn value when it should only return
      // meta.outKey: GetInteract
      // qId: StoreTempSelectionState
      delete response[RETURN_KEY];
    }
    if (hasOwnProperty.call(response, RETURN_KEY)) {
      return response[RETURN_KEY];
    }
    if (request.outKey !== -1) {
      return response[request.outKey];
    }
    return response;
  }

  /**
  * Process result interceptor.
  * @private
  * @param {Session} session - The session the intercept is being executed on.
  * @param {Object} request - The JSON-RPC request.
  * @param {Object} response - The response.
  * @returns {Object} - Returns the result property on the response
  */
  function resultResponseInterceptor(session, request, response) {
    return response.result;
  }

  function _typeof$2(obj) { "@babel/helpers - typeof"; return _typeof$2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$2(obj); }
  function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
  function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
  function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
  function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
  function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
  function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
  function _classCallCheck$2(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$2(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$2(descriptor.key), descriptor); } }
  function _createClass$2(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$2(Constructor.prototype, protoProps); if (staticProps) _defineProperties$2(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$2(arg) { var key = _toPrimitive$2(arg, "string"); return _typeof$2(key) === "symbol" ? key : String(key); }
  function _toPrimitive$2(input, hint) { if (_typeof$2(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$2(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

  /**
   * Interceptor is a concept similar to mixins, but runs on a lower level. The interceptor concept
   * can augment either the requests (i.e. before sent to QIX Engine), or the responses (i.e. after
   * QIX Engine has sent a response). The interceptor promises run in parallel to the regular
   * promises used in enigma.js, which means that it can be really useful when you want to normalize
   * behaviors in your application.
   * @interface Interceptor
   */

  /**
   * @class InterceptorRequest
   * @implements {Interceptor}
   * @example <caption>Implement a request interceptor</caption>
   * const enigma = require('enigma.js');
   * const WebSocket = require('ws');
   * const schema = require('enigma.js/schemas/12.20.0.json');
   *
   * const session = enigma.create({
   *   schema,
   *   url: 'ws://localhost:9076/app/engineData',
   *   createSocket: (url) => new WebSocket(url),
   *   requestInterceptors: [{
   *     onFulfilled: function logRequest(sessionReference, request) {
   *       console.log('Request being sent', request);
   *       return request;
   *     }
   *   },
   * });
   */

  /**
   * @class InterceptorResponse
   * @implements {Interceptor}
   * @example <caption>Implement a request interceptor</caption>
   * const enigma = require('enigma.js');
   * const WebSocket = require('ws');
   * const schema = require('enigma.js/schemas/12.20.0.json');
   *
   * const session = enigma.create({
   *   schema,
   *   url: 'ws://localhost:9076/app/engineData',
   *   createSocket: (url) => new WebSocket(url),
   *   responseInterceptors: [{
   *     onRejected: function logError(sessionReference, request, error) {
   *       console.log('Error returned from QIX engine', error, 'Originating request:', request);
   *       // throw error so it's continued to be rejected:
   *       throw error;
   *     }
   *   },
   * });
   */

  /**
   * This method is invoked when a request is about to be sent to QIX Engine.
   * @function InterceptorRequest#onFulfilled
   * @param {Session} session The session executing the interceptor.
   * @param {Object} request The JSON-RPC request that will be sent.
   */

  /**
   * This method is invoked when a previous interceptor has rejected the
   * promise; use this to handle, for example, errors before they are sent into mixins.
   * @function InterceptorResponse#onRejected
   * @param {Session} session The session executing the interceptor. You may use .retry() to retry
   * sending it to QIX Engine.
   * @param {Object} request The JSON-RPC request resulting in this error.
   * @param {Object} error Whatever the previous interceptor is rejected with.
   */

  /**
   * This method is invoked when a promise has been successfully resolved;
   * use this to modify the result or reject the promise chain before it is sent
   * to mixins.
   * @function InterceptorResponse#onFulfilled
   * @param {Session} session The session executing the interceptor.
   * @param {Object} request The JSON-RPC request resulting in this response.
   * @param {Object} result Whatever the previous interceptor is resolved with.
   */
  var Intercept = /*#__PURE__*/function () {
    /**
    * Create a new Intercept instance.
    * @private
    * @param {Object} options The configuration options for this class.
    * @param {Promise<Object>} options.Promise The promise constructor to use.
    * @param {ApiCache} options.apis The ApiCache instance to use.
    * @param {Array<Object>} [options.request] The additional request interceptors to use.
    * @param {Array<Object>} [options.response] The additional response interceptors to use.
    */
    function Intercept(options) {
      _classCallCheck$2(this, Intercept);
      Object.assign(this, options);
      this.request = [{
        onFulfilled: deltaRequestInterceptor
      }].concat(_toConsumableArray(this.request || []));
      this.response = [{
        onFulfilled: errorResponseInterceptor
      }, {
        onFulfilled: deltaResponseInterceptor
      }, {
        onFulfilled: resultResponseInterceptor
      }, {
        onFulfilled: outParamResponseInterceptor
      }].concat(_toConsumableArray(this.response || []), [{
        onFulfilled: apiResponseInterceptor
      }]);
    }

    /**
    * Execute the request interceptor queue, each interceptor will get the result from
    * the previous interceptor.
    * @private
    * @param {Session} session The session instance to execute against.
    * @param {Promise<Object>} promise The promise to chain on to.
    * @returns {Promise<Object>}
    */
    _createClass$2(Intercept, [{
      key: "executeRequests",
      value: function executeRequests(session, promise) {
        var _this = this;
        return this.request.reduce(function (interception, interceptor) {
          var intercept = interceptor.onFulfilled && interceptor.onFulfilled.bind(_this, session);
          return interception.then(intercept);
        }, promise);
      }

      /**
      * Execute the response interceptor queue, each interceptor will get the result from
      * the previous interceptor.
      * @private
      * @param {Session} session The session instance to execute against.
      * @param {Promise<Object>} promise The promise to chain on to.
      * @param {Object} request The JSONRPC request object for the intercepted response.
      * @returns {Promise<Object>}
      */
    }, {
      key: "executeResponses",
      value: function executeResponses(session, promise, request) {
        var _this2 = this;
        return this.response.reduce(function (interception, interceptor) {
          return interception.then(interceptor.onFulfilled && interceptor.onFulfilled.bind(_this2, session, request), interceptor.onRejected && interceptor.onRejected.bind(_this2, session, request));
        }, promise);
      }
    }]);
    return Intercept;
  }();

  function _typeof$1(obj) { "@babel/helpers - typeof"; return _typeof$1 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof$1(obj); }
  function _classCallCheck$1(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties$1(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey$1(descriptor.key), descriptor); } }
  function _createClass$1(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$1(Constructor.prototype, protoProps); if (staticProps) _defineProperties$1(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey$1(arg) { var key = _toPrimitive$1(arg, "string"); return _typeof$1(key) === "symbol" ? key : String(key); }
  function _toPrimitive$1(input, hint) { if (_typeof$1(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof$1(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  function _get() { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get.bind(); } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(arguments.length < 3 ? target : receiver); } return desc.value; }; } return _get.apply(this, arguments); }
  function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }
  function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }
  function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }
  function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }
  function _possibleConstructorReturn(self, call) { if (call && (_typeof$1(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }
  function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
  function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }
  function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

  /**
  * API cache for instances of QIX types, e.g. GenericObject.
  * @private
  * @extends KeyValueCache
  */
  var ApiCache = /*#__PURE__*/function (_KeyValueCache) {
    _inherits(ApiCache, _KeyValueCache);
    var _super = _createSuper(ApiCache);
    function ApiCache() {
      _classCallCheck$1(this, ApiCache);
      return _super.apply(this, arguments);
    }
    _createClass$1(ApiCache, [{
      key: "add",
      value:
      /**
      * Adds an API.
      * @private
      * @function ApiCache#add
      * @param {Number} handle - The handle for the API.
      * @param {*} api - The API.
      * @returns {{api: *}} The entry.
      */
      function add(handle, api) {
        var _this = this;
        var entry = {
          api: api
        };
        _get(_getPrototypeOf(ApiCache.prototype), "add", this).call(this, handle.toString(), entry);
        api.on('closed', function () {
          return _this.remove(handle);
        });
        return entry;
      }

      /**
      * Gets an API.
      * @private
      * @function ApiCache#getApi
      * @param {Number} handle - The handle for the API.
      * @returns {*} The API for the handle.
      */
    }, {
      key: "getApi",
      value: function getApi(handle) {
        var entry = typeof handle !== 'undefined' ? this.get(handle.toString()) : undefined;
        return entry && entry.api;
      }

      /**
      * Gets a list of APIs.
      * @private
      * @function ApiCache#getApis
      * @returns {Array} The list of entries including `handle` and `api` properties for each entry.
      */
    }, {
      key: "getApis",
      value: function getApis() {
        return _get(_getPrototypeOf(ApiCache.prototype), "getAll", this).call(this).map(function (entry) {
          return {
            handle: entry.key,
            api: entry.value.api
          };
        });
      }

      /**
      * Gets a list of APIs with a given type.
      * @private
      * @function ApiCache#getApisByType
      * @param {String} type - The type of APIs to get.
      * @returns {Array} The list of entries including `handle` and `api` properties for each entry.
      */
    }, {
      key: "getApisByType",
      value: function getApisByType(type) {
        return this.getApis().filter(function (entry) {
          return entry.api.type === type;
        });
      }
    }]);
    return ApiCache;
  }(KeyValueCache);

  function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return _typeof(key) === "symbol" ? key : String(key); }
  function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

  /**
   * The enigma.js configuration object.
   * @interface Configuration
   * @property {Object} schema Object containing the specification for the API to generate.
   * Corresponds to a specific version of the QIX Engine API.
   * @property {String} url String containing a proper websocket URL to QIX Engine.
   * @property {Function} [createSocket] A function to use when instantiating the WebSocket,
   * mandatory for Node.js.
   * @property {Object} [Promise] ES6-compatible Promise library.
   * @property {Boolean} [suspendOnClose=false] Set to true if the session should be suspended
   * instead of closed when the websocket is closed.
   * @property {Array<Mixin>} [mixins=[]] Mixins to extend/augment the QIX Engine API. Mixins
   * are applied in the array order.
   * @property {Array} [requestInterceptors=[]] Interceptors for augmenting requests before they
   * are sent to QIX Engine. Interceptors are applied in the array order.
   * @property {Array} [responseInterceptors=[]] Interceptors for augmenting responses before they
   * are passed into mixins and end-users. Interceptors are applied in the array order.
   * @property {Object} [protocol={}] An object containing additional JSON-RPC request parameters.
   * @property {Boolean} [protocol.delta=true] Set to false to disable the use of the
   * bandwidth-reducing delta protocol.
   * @example <caption>Example defining a configuration object</caption>
   * const enigma = require('enigma.js');
   * const WebSocket = require('ws');
   * const bluebird = require('bluebird');
   * const schema = require('enigma.js/schemas/12.20.0.json');
   *
   * const config = {
   *  schema,
   *  url: 'ws://localhost:4848/app/engineData',
   *  createSocket: url => new WebSocket(url),
   *  Promise: bluebird,
   *  suspendOnClose: true,
   *  mixins: [{ types: ['Global'], init: () => console.log('Mixin ran') }],
   *  protocol: { delta: false },
   * };
   *
   * enigma.create(config).open().then((global) => {
   *   // global === QIX global interface
   *   process.exit(0);
   * });
   */

  /**
   * The mixin concept allows you to add or override QIX Engine API functionality. A mixin is
   * basically a JavaScript object describing which types it modifies, and a list of functions
   * for extending and overriding the API for those types.
   *
   * QIX Engine types like, for example, GenericObject, Doc, GenericBookmark, are supported but
   * also custom GenericObject types such as barchart, story and myCustomType. An API will get
   * both their generic type as well as custom type mixins applied.
   *
   * Mixins that are bound to several different types can find the current API type in the
   * `genericType` or `type` members. `this.type` would, for instance, return `GenericObject` and
   * `this.genericType` would return `barchart`.
   *
   * See the Mixins examples on how to use it. Below is an outline of what the mixin API consists of.
   *
   * @interface Mixin
   * @property {String|Array<String>} types String or array of strings containing the API-types that
   * will be mixed in.
   * @property {Object} [extend] Object literal containing the methods that will be extended on the
   * specified API.
   * @property {Object} [override] Object literal containing the methods to override existing methods.
   * @property {Function} [init] Init function that, if defined, will run when an API is instantiated.
   * It runs with Promise and API object as parameters.
   */

  /**
   * The API for generated APIs depends on the QIX Engine schema you pass into your Configuration, and
   * on what QIX struct the API has.
   *
   * All API calls made using the generated APIs will return promises that are either resolved or
   * rejected depending on how the QIX Engine responds.
   *
   * @interface API
   * @property {String} id Contains the unique identifier for this API.
   * @property {String} type Contains the schema class name for this API.
   * @property {String} genericType Corresponds to the qInfo.qType property on the generic object's
   * properties object.
   * @property {Session} session Contains a reference to the session that this API belongs to.
   * @property {Number} handle Contains the handle QIX Engine assigned to the API. Used interally in
   * enigma.js for caches and JSON-RPC requests.
   * @example <caption>Example using `global` and `generic object` struct APIs</caption>
   * global.openDoc('my-document.qvf').then((doc) => {
   *   doc.createObject({ qInfo: { qType: 'my-object' } }).then(api => { });
   *   doc.getObject('object-id').then(api => { });
   *   doc.getBookmark('bookmark-id').then(api => { });
   * });
   */

  /**
   * Handles changes on the API. The changed event is triggered whenever enigma.js or QIX Engine has
   * identified potential changes on the underlying properties or hypercubes and you should re-fetch
   * your data.
   * @event API#changed
   * @type {Object}
   * @example <caption>Bind the `changed` event</caption>
   * api.on('changed', () => {
   *   api.getLayout().then(layout => { });
   * });
   */

  /**
   * Handles closed API. The closed event is triggered whenever QIX Engine considers an API closed.
   * It usually means that it no longer exists in the QIX Engine document or session.
   * @event API#closed
   * @type {Object}
   * @example <caption>Bind the `closed` event</caption>
   * api.on('closed', () => {
   *   console.log(api.id, 'was closed');
   * });
   */

  /**
   * Handles JSON-RPC requests/responses for this API. Generally used in debugging purposes.
   * `traffic:*` will handle all websocket messages, `traffic:sent` will handle outgoing messages
   * and `traffic:received` will handle incoming messages.
   * @event API#traffic
   * @type {Object}
   * @example <caption>Bind the traffic events</caption>
   * // bind both in- and outbound traffic to console.log:
   * api.on('traffic:*', console.log);
   * // bind outbound traffic to console.log:
   * api.on('traffic:sent', console.log);
   * // bind inbound traffic to console.log:
   * api.on('traffic:received', console.log);
   */
  var Enigma = /*#__PURE__*/function () {
    function Enigma() {
      _classCallCheck(this, Enigma);
    }
    _createClass(Enigma, null, [{
      key: "getSession",
      value:
      /**
       * Function used to get a session.
       * @private
       * @param {Configuration} config The configuration object for this session.
       * @returns {Session} Returns a session instance.
       */
      function getSession(config) {
        var createSocket = config.createSocket,
          Promise = config.Promise,
          requestInterceptors = config.requestInterceptors,
          responseInterceptors = config.responseInterceptors,
          url = config.url;
        var apis = new ApiCache();
        var intercept = new Intercept({
          apis: apis,
          Promise: Promise,
          request: requestInterceptors,
          response: responseInterceptors
        });
        var rpc = new RPC({
          createSocket: createSocket,
          Promise: Promise,
          url: url
        });
        var suspendResume = new SuspendResume({
          apis: apis,
          Promise: Promise,
          rpc: rpc
        });
        var session = new Session({
          apis: apis,
          config: config,
          intercept: intercept,
          rpc: rpc,
          suspendResume: suspendResume
        });
        return session;
      }

      /**
      * Function used to configure defaults.
      * @private
      * @param {Configuration} config The configuration object for how to connect
      *                               and retrieve end QIX APIs.
      */
    }, {
      key: "configureDefaults",
      value: function configureDefaults(config) {
        if (!config) {
          throw createEnigmaError(errorCodes.NO_CONFIG_SUPPLIED, 'You need to supply a configuration.');
        }

        // eslint-disable-next-line no-restricted-globals
        if (!config.Promise && typeof Promise === 'undefined') {
          throw createEnigmaError(errorCodes.PROMISE_REQUIRED, 'Your environment has no Promise implementation. You must provide a Promise implementation in the config.');
        }
        if (typeof config.createSocket !== 'function' && typeof WebSocket === 'function') {
          // eslint-disable-next-line no-undef
          config.createSocket = function (url) {
            return new WebSocket(url);
          };
        }
        if (typeof config.suspendOnClose === 'undefined') {
          config.suspendOnClose = false;
        }
        config.protocol = config.protocol || {};
        config.protocol.delta = typeof config.protocol.delta !== 'undefined' ? config.protocol.delta : true;
        // eslint-disable-next-line no-restricted-globals
        config.Promise = config.Promise || Promise;
        config.mixins = config.mixins || [];
        config.definition = config.definition || new Schema(config);
      }

      /**
      * Function used to create a QIX session.
      * @entry
      * @param {Configuration} config The configuration object for the QIX session.
      * @returns {Session} Returns a new QIX session.
      * @example <caption>Example minimal session creation</caption>
      * const enigma = require('enigma.js');
      * const schema = require('enigma.js/schemas/12.20.0.json');
      * const WebSocket = require('ws');
      * const config = {
      *   schema,
      *   url: 'ws://localhost:9076/app/engineData',
      *   createSocket: url => new WebSocket(url),
      * };
      * const session = enigma.create(config);
      */
    }, {
      key: "create",
      value: function create(config) {
        Enigma.configureDefaults(config);
        config.mixins.forEach(function (mixin) {
          config.definition.registerMixin(mixin);
        });
        return Enigma.getSession(config);
      }
    }]);
    return Enigma;
  }();

  return Enigma;

}));
//# sourceMappingURL=enigma.js.map
