// Initialize the MIDI library.
(function (global, exports, perf)
{
    'use strict';
    var 
    message,
    JazzInstance = function ()
    {
        var o1, o2, e, a, insertionPoint;

        this.inputInUse = false;
        this.outputInUse = false;

        // load the Jazz plugin
        o1 = document.createElement("object");
        o1.id = "_Jazz" + Math.random() + "ie";
        o1.classid = "CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90";

        this.activeX = o1;

        o2 = document.createElement("object");
        o2.id = "_Jazz" + Math.random;
        o2.type = "audio/x-jazz";

        // ji: added to stop Jazz interfering with my window
        // I've added a link to Jazz anyway at the top of my page.
        o2.setAttribute("style", "visibility:hidden;");

        o1.appendChild(o2);

        this.objRef = o2;

        e = document.createElement("p");
        e.appendChild(document.createTextNode("This page requires the "));

        a = document.createElement("a");
        a.appendChild(document.createTextNode("Jazz plugin"));
        a.href = "http://jazz-soft.net/";

        e.appendChild(a);
        e.appendChild(document.createTextNode("."));

        o2.appendChild(e);

        insertionPoint = document.getElementById("MIDIPlugin");
        if (!insertionPoint)
        {
            insertionPoint = document.body;
        }
        insertionPoint.appendChild(o1);

        if (this.objRef.isJazz)
        {
            this._Jazz = this.objRef;
        }
        else if (this.activeX.isJazz)
        {
            this._Jazz = this.activeX;
        }
        else
        {
            this._Jazz = null;
        }
        if (this._Jazz)
        {
            this._Jazz._jazzTimeZero = this._Jazz.Time();
            this._Jazz._perfTimeZero = window.performance.now();
        }
    },

    // API method
    MIDIAccess = function (successCallback, errorCallback)
    {
        this._jazzInstances = [];
        this._jazzInstances.push(new JazzInstance());

        if (this._jazzInstances[0]._Jazz)
        {
            this._Jazz = this._jazzInstances[0]._Jazz;
            // this._successCallback = successCallback;
            // window.setTimeout(_onReady.bind(this), 3);
            successCallback(this);

        } else
        {
            if (errorCallback)
            {
                errorCallback({ code: 1 });
            }
        }
    },

    _requestMIDIAccess = function (successCallback, errorCallback)
    {
        new MIDIAccess(successCallback, errorCallback);
    },

    _getMIDIAccess = function (successCallback, errorCallback)
    {
        var message = "getMIDIAccess has been renamed to requestMIDIAccess.  Please update your code.";

        if (console.warn)
        {
            console.warn(message);
        }
        else
        {
            console.log(message);
        }
        new MIDIAccess(successCallback, errorCallback);
    },

    MIDIPort = function (midi, port, index, type)
    {
        this._index = index;
        this._midi = midi;
        this.type = type;

        // Can't get manu/version from Jazz
        this.name = port;
        this.manufacturer = "<manufacturer unknown>";
        this.version = "<version not supported>";
        this.fingerprint = index + "." + this.name;
    },

    // ji: this function creates a new, custom event and then dispatches it.
    // The event's timestamp and data fields are set here.
    // cw: _midiProc = function (timestamp, data)
    _midiProc = function (timestamp, status, data1, data2)
    {
        var evt = {}, length = 0, i, j;

        // ji: removed the following constructor call. Used a simple object instead (see above).
        // The CustomEvent() definition was missing in the original file.
        // evt = new CustomEvent("message");

        // abudaan used the above _midiProc signature, and it seems to work, so I've removed this loop
        //        // Jazz sometimes passes us multiple messages at once, so we need to parse them out
        //        // and pass them one at a time.
        //        for (i = 0; i < data.length; i += length)
        //        {
        switch (status & 0xF0)
        {
            case 0x80:  // note off
            case 0x90:  // note on
            case 0xA0:  // polyphonic aftertouch 
            case 0xB0:  // control change
            case 0xE0:  // channel mode
                length = 3;
                break;

            case 0xC0:  // program change
            case 0xD0:  // channel aftertouch
                length = 2;
                break;

            case 0xF0:
                switch (status)
                {
                    case 0xf0:  // variable-length sysex.
                        // count the length;
                        length = -1;
                        j = i + 1;
                        while ((j < data.length) && (data[j] !== 0xF7))
                        {
                            ++j;
                        }
                        length = j - i + 1;
                        break;

                    case 0xF1:  // MTC quarter frame
                    case 0xF3:  // song select
                        length = 2;
                        break;

                    case 0xF2:  // song position pointer
                        length = 3;
                        break;

                    default:
                        length = 1;
                        break;
                }
                break;
        }

        evt.timestamp = parseFloat(timestamp.toString()) + this._jazzInstance._perfTimeZero;
        evt.data = new Uint8Array(length);
        switch (length)
        {
            case 1:
                break;
            case 2:
                evt.data[0] = status;
                evt.data[1] = data1;
                this.dispatchEvent(evt);
                break;
            case 3:
                evt.data[0] = status;
                evt.data[1] = data1;
                evt.data[2] = data2;
                this.dispatchEvent(evt);
                break;
            default:
                console.log("Attention: This code has not been checked! (SysEx etc. messages)");
                evt.data[0] = status;
                for (i = 1; i < length; ++i)
                {
                    evt.data[i] = data1[i - 1];
                }
                this.dispatchEvent(evt);
                break;
        }
    },

    MIDIInput = function (midiAccess, target)
    {
        var i, list, dot, inputInstance = null;

        this.onmessage = null;
        this._listeners = [];
        this._midiAccess = midiAccess;

        for (i = 0; (i < midiAccess._jazzInstances.length) && (!inputInstance); i++)
        {
            if (!midiAccess._jazzInstances[i].inputInUse)
            {
                inputInstance = midiAccess._jazzInstances[i];
            }
        }
        if (!inputInstance)
        {
            inputInstance = new JazzInstance();
            midiAccess._jazzInstances.push(inputInstance);
        }
        inputInstance.inputInUse = true;

        this._jazzInstance = inputInstance._Jazz;

        // target can be a MIDIPort or DOMString 
        if (target instanceof MIDIPort)
        {
            this._deviceName = target.name;
            this._index = target._index;
        } else if (typeof target === "number")
        { // target is numerical index
            this._index = target;
            list = this._jazzInstance.MidiInList();
            this._deviceName = list[target];
        } else if (target.isString())
        { // fingerprint 
            dot = target.indexOf(".");
            this._index = parseInt(target.slice(0, dot));
            this._deviceName = target.slice(dot + 1);
        }

        this._input = this._jazzInstance.MidiInOpen(this._index, _midiProc.bind(this));
    },

    MIDIOutput = function (midiAccess, target)
    {
        var i, list, dot, outputInstance = null;

        this._midiAccess = midiAccess;

        for (i = 0; (i < midiAccess._jazzInstances.length) && (!outputInstance); i++)
        {
            if (!midiAccess._jazzInstances[i].outputInUse)
            {
                outputInstance = midiAccess._jazzInstances[i];
            }
        }
        if (!outputInstance)
        {
            outputInstance = new JazzInstance();
            midiAccess._jazzInstances.push(outputInstance);
        }
        outputInstance.outputInUse = true;

        this._jazzInstance = outputInstance._Jazz;

        // target can be a MIDIPort or DOMString 
        if (target instanceof MIDIPort)
        {
            this._deviceName = target.name;
            this._index = target._index;
        } else if (typeof target === "number")
        { // target is numerical index
            this._index = target;
            list = this._jazzInstance.MidiOutList();
            this._deviceName = list[target];
        } else if (target.isString())
        { // fingerprint 
            dot = target.indexOf(".");
            this._index = parseInt(target.slice(0, dot));
            this._deviceName = target.slice(dot + 1);
        }

        this._jazzInstance.MidiOutOpen(this._deviceName);
    },

    _sendLater = function ()
    {
        this.jazz.MidiOutLong(this.data);    // handle send as sysex
    },

    debug = false;

    // end of var **************************************************

    if (debug)
    {
        window.console.warn('Debugging enabled');
    }

    //init: create plugin
    if (!window.navigator.requestMIDIAccess)
    {
        window.navigator.requestMIDIAccess = _requestMIDIAccess;
        if (!window.navigator.getMIDIAccess)
        {
            window.navigator.getMIDIAccess = _getMIDIAccess;
        }
    }

    //    function _onReady()
    //    {
    //        if (this._successCallback)
    //            this._successCallback(this);
    //    }

    // API Methods
    MIDIAccess.prototype.getInputs = function ()
    {
        var i, list, inputs;

        if (!this._Jazz)
        {
            return null;
        }
        list = this._Jazz.MidiInList();
        inputs = [];

        for (i = 0; i < list.length; i++)
        {
            inputs.push(new MIDIPort(this, list[i], i, "input"));
        }
        return inputs;
    };

    MIDIAccess.prototype.getOutputs = function ()
    {
        var i, list, outputs;

        if (!this._Jazz)
        {
            return null;
        }
        list = this._Jazz.MidiOutList();
        outputs = [];

        for (i = 0; i < list.length; i++)
        {
            outputs.push(new MIDIPort(this, list[i], i, "output"));
        }
        return outputs;
    };

    // ji: Replaced these versions. They kept warning me, even after I had updated my code.
    //     Throwing an exception is also the wrong thing to do!
    //MIDIAccess.prototype.enumerateInputs = function ()
    //{
    //    var message = "MIDIAccess.enumerateInputs has been renamed to MIDIAccess.getInputs.  Please update your code.";

    //    if (console.warn)
    //    {
    //        console.warn(message);
    //    }
    //    else
    //    {
    //        console.log(message);
    //    }
    //    return this.getInputs();
    //};
    if (MIDIAccess.prototype.hasOwnProperty("enumerateInputs"))
    {
        message = "MIDIAccess.enumerateInputs has been renamed to MIDIAccess.getInputs.  Please update your code.";

        if (console.warn)
        {
            console.warn(message);
        }
        else
        {
            console.log(message);
        }
    }

    //MIDIAccess.prototype.enumerateOutputs = function ()
    //{
    //    var message = "MIDIAccess.enumerateOutputs has been renamed to MIDIAccess.getOutputs.  Please update your code.";

    //    if (console.warn)
    //    {
    //        console.warn(message);
    //    }
    //    else
    //    {
    //        console.log(message);
    //    }
    //    return this.getOutputs();
    //};
    if (MIDIAccess.prototype.hasOwnProperty("enumerateOutputs"))
    {
        message = "MIDIAccess.enumerateOutputs has been renamed to MIDIAccess.getOutputs.  Please update your code.";

        if (console.warn)
        {
            console.warn(message);
        }
        else
        {
            console.log(message);
        }
    }

    MIDIAccess.prototype.getInput = function (target)
    {
        if (target === null)
        {
            return null;
        }
        return new MIDIInput(this, target);
    };

    MIDIAccess.prototype.getOutput = function (target)
    {
        if (target === null)
        {
            return null;
        }
        return new MIDIOutput(this, target);
    };

    MIDIPort.prototype.toString = function ()
    {
        return ("type: " + this.type + "name: '" + this.name + "' manufacturer: '" +
                this.manufacturer + "' version: " + this.version + " fingerprint: '" + this.fingerprint + "'");
    };


    // Introduced in DOM Level 2:
    MIDIInput.prototype.addEventListener = function (type, listener, useCapture)
    {
        var i;

        if (type !== "message")
        {
            return;
        }
        for (i = 0; i < this._listeners.length; i++)
        {
            if (this._listeners[i] === listener)
            {
                return;
            }
        }
        this._listeners.push(listener);
    };

    MIDIInput.prototype.removeEventListener = function (type, listener, useCapture)
    {
        var i;

        if (type !== "message")
        {
            return;
        }
        for (i = 0; i < this._listeners.length; i++)
        {
            if (this._listeners[i] === listener)
            {
                this._listeners.splice(i, 1);  //remove it
                return;
            }
        }
    };

    MIDIInput.prototype.preventDefault = function ()
    {
        this._pvtDef = true;
    };

    MIDIInput.prototype.dispatchEvent = function (evt)
    {
        var i;

        this._pvtDef = false;

        // dispatch to listeners
        for (i = 0; i < this._listeners.length; i++)
        {
            if (this._listeners[i].handleEvent)
            {
                this._listeners[i].handleEvent.bind(this)(evt);
            }
            else
            {
                this._listeners[i].bind(this)(evt);
            }
        }

        if (this.onmessage)
        {
            this.onmessage(evt);
        }

        return this._pvtDef;
    };

    MIDIOutput.prototype.send = function (data, timestamp)
    {
        var sendObj, delayBeforeSend = 0;

        if (data.length === 0)
        {
            return false;
        }

        if (timestamp)
        {
            delayBeforeSend = Math.floor(timestamp - window.performance.now());
        }

        if (timestamp && (delayBeforeSend > 1))
        {
            sendObj = {};
            sendObj.jazz = this._jazzInstance;
            sendObj.data = data;

            window.setTimeout(_sendLater.bind(sendObj), delayBeforeSend);
        } else
        {
            this._jazzInstance.MidiOutLong(data);
        }
        return true;
    };

} (window));

// Polyfill window.performance.now() if necessary.
(function (exports)
{
    'use strict';

    var perf = {},
        props;

    // Returns an object having a 'value' member set to a function which takes no arguments.
    // The function is the now() function we are looking for, which returns DOMHRT time as accurately as possible
    function findAlt()
    {
        var prefix = ["moz", "webkit", "opera" ,"ms"],
            i, completeName,
            // worst case, we use a function which returns Date.now() - start.
            // (start is set to Date.now() when Jazz is starting up).
            props = {
                value: (function (start)
                {
                    return function ()
                    {
                        return Date.now() - start;
                    };
                } (Date.now()))
            };

        //seach for vendor prefixed version  
        for (i = prefix.length; i >= 0; i--)
        {
            // ji: changed 14.01.2013 to keep JSLint happy
            //if ((prefix[i] + "Now") in exports.performance)
            completeName = prefix[i] + "Now";
            if(exports.performance.hasOwnProperty(completeName))
            {    
                props.value = (function (method)
                {
                    return function ()
                    {
                        exports.performance[method]();
                    };
                } (completeName));
                return props;
            }
        }

        //otherwise (if return wasnt hit 4 lines up), try to use connectionStart

        // ji: 'in' not used, to keep JSLint happy 
        // if ("timing" in exports.performance &&
        //    "connectStart" in exports.performance.timing)
        if (exports.performance.hasOwnProperty("timing") &&
            exports.performance.timing.hasOwnProperty("connectStart"))
        {
            //this pretty much approximates performance.now() to the millisecond
            props.value = (function (start)
            {
                return function ()
                {
                    // ji: return added 
                    return Date.now() - start;
                };
            } (exports.performance.timing.connectStart));
        }
        return props;
    }

    //if already defined, bail
    // ji: 'in' not used, to keep JSLint happy    
    // if (("performance" in exports) && ("now" in exports.performance))
    if (exports.hasOwnProperty("performance") && exports.performance.hasOwnProperty("now"))
    {
        return;
    }

    // ji: 'in' not used, to keep JSLint happy
    //if (!("performance" in exports))
    if (!exports.hasOwnProperty("performance"))
    {
        Object.defineProperty(exports, "performance", {
            get: function ()
            {
                return perf;
            }
        });
        //otherwise, performance is there, but not "now()"    
    }

    props = findAlt();

    Object.defineProperty(exports.performance, "now", props);

} (window));


