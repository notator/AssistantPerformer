/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  Event.js
 *  The WEB_MIDI_LIB.event namespace which exposes
 *      1. MIDI constants for analysing and constructing MIDI events
 *         These constants are categorised and defined in the following objects:
 *                  COMMAND
 *                  RUNNING_STATUS
 *                  CONTROL
 *                  SYSTEM_EXCLUSIVE
 *      2. SysExEvent(...): a constructor for System Exclusive messages
 *      3. Event(...): a constructor for all other Events (including RUNNING_STATUS events)
 *      4. Factory constructor getEvent(data) for use when receiving input MIDI data.
 *      5. the function to14Bit(value) which returns an object containing the equivalent two 7-bit
 *         values (for use when calculating the arguments to a new PITCH_WHEEL MidiEvent).
 *      6. and the converse function: value = from14Bit(sevenBitData1, sevenBitData2).
 *         Not sure if we need this, but it might be useful when receiving PITCH_WHEEL events.
 *      Both 4 and 5 need checking!!
 *      7. The function isRunningStatus(constant) which returns true if constant is in RUNNING_STATUS
 *         otherwise false.  
 *
 *  Event constructor
 *          Event(status, data1, data2, timestamp)
 *  This constructor is for all event types except SYSTEM_EXCLUSIVE (see special constructor below).
 *  The data2 and timestamp arguments are optional. They both default to 0.
 *  An exception is thrown if status, data1 and data2 are not in range 0x00 to 0xFF, or are otherwise
 *  illegal.
 *  timestamp is the number of (floating point) milliseconds from the start of the file or performance.
 *  If this constructor is being used while reading a Standard MIDI File, timestamp must be calculated
 *  from the times in the file (whose origin is the previous event).
 *  An exception is thrown if timestamp is negative.
 *
 *  SysExEvent constructor
 *          SysExEvent(dataArray, timestamp)
 *  The dataArray is an ordinary Javascript array of numbers in the range 0x0 to 0xFF.
 *  dataArray[0] must be 0xF0, dataArray[dataArray.length - 1] must be 0xF7.
 */

WEB_MIDI_LIB.namespace('WEB_MIDI_LIB.event');

WEB_MIDI_LIB.event = (function (window)
{
    "use strict";
    var 
    COMMAND =
    {
        NOTE_OFF: 0x80,
        NOTE_ON: 0x90,
        POLY_AFTERTOUCH: 0xA0,
        CONTROL_CHANGE: 0xB0,
        PROGRAM_CHANGE: 0xC0,
        CHANNEL_AFTERTOUCH: 0xD0,
        PITCH_WHEEL: 0xE0 // use to14Bit() to calculate the data1Arg and data2Arg constructor arguments
    },

    // Am I right in thinking that these are the RUNNING_STATUS constants?
    // We probably need them if an application is going to be sending a stream of Events.
    // 0xF4, 0xF5, and 0xFD are missing. Do they do anything?
    RUNNING_STATUS =
    {
        // 0xF0 is SYSTEM_EXCLUSIVE.START 
        MTC_QUARTER_FRAME: 0xF1,
        SONG_POSITION_POINTER: 0xF2,
        SONG_SELECT: 0xF3,
        // ? : 0xF4,
        // ? : 0xF5,
        TUNE_REQUEST: 0xF6,
        // 0xF7 is SYSTEM_EXCLUSIVE.END 
        MIDI_CLOCK: 0xF8,
        MIDI_TICK: 0xF9,
        MIDI_START: 0xFA,
        MIDI_CONTINUE: 0xFB,
        MIDI_STOP: 0xFC,
        // ? : 0xFD;
        ACTIVE_SENSE: 0xFE,
        RESET: 0xFF
    },

    CONTROL =
    {
        // These are all I use for the moment.
        // This list needs to be completed.
        MODWHEEL: 1,
        DATA_ENTRY_COARSE: 6, // used when setting pitch wheel deviation
        PAN: 10,
        EXPRESSION: 11,
        REGISTERED_PARAMETER_FINE: 100, // used when setting pitch wheel deviation
        REGISTERED_PARAMETER_COARSE: 101 // used when setting pitch wheel deviation
    },

    SYSTEM_EXCLUSIVE =
    {
        START: 0xF0,
        END: 0xF7
    },

    _length,

    
    _getDataValues = function (argsLength, data1Arg, data2Arg)
    {
        var values;

        values.data1 = data1Arg;

        if (argsLength === 1 || argsLength === 2)
        {
            values.data2 = 0;
        }
        if (argsLength === 3 || argsLength === 4)
        {
            values.data2 = data2Arg;
        }
        else
        {
            throw "Error: Too many arguments!";
        }

        return values;
    },

    _checkArgSizes = function (status, data1, data2)
    {
        if (status < 0 || status > 0xFF)
        {
            throw "Error: status out of range.";
        }
        if (data1 < 0 || data1 > 0xFF)
        {
            throw "Error: data1 out of range.";
        }
        if (data2 < 0 || data2 > 0xFF)
        {
            throw "Error: data2 out of range.";
        }
    },

    _getTimestamp = function (argsLength, timestamp)
    {
        var returnValue;

        if (argsLength < 4)
        {
            returnValue = 0;
        }
        else
        {
            returnValue = timestamp;
        }

        if (returnValue < 0)
        {
            throw "Error: negative timestamp.";
        }

        return returnValue;
    },

    _getLength = function (status)
    {
        var length = -1, command = status & 0xF0;

        switch (command)
        {
            case COMMAND.NOTE_OFF:
            case COMMAND.NOTE_ON:
            case COMMAND.POLY_AFTERTOUCH:
            case COMMAND.CONTROL_CHANGE:
            case COMMAND.PITCH_WHEEL:
                length = 3;
                break;
            case COMMAND.PROGRAM_CHANGE:
            case COMMAND.CHANNEL_AFTERTOUCH:
                length = 2;
                break;
        }
        if (length === -1)
        {
            switch (status)
            {
                case SYSTEM_EXCLUSIVE.START:
                    throw "Error: Use the special SysExEvent constructor to construct variable length events.";
                case RUNNING_STATUS.TUNE_REQUEST:
                case RUNNING_STATUS.MIDI_CLOCK:
                case RUNNING_STATUS.MIDI_TICK:
                case RUNNING_STATUS.MIDI_START:
                case RUNNING_STATUS.MIDI_CONTINUE:
                case RUNNING_STATUS.MIDI_STOP:
                case RUNNING_STATUS.ACTIVE_SENSE:
                case RUNNING_STATUS.RESET:
                    length = 1;
                    break;
                case RUNNING_STATUS.MTC_QUARTER_FRAME:
                case RUNNING_STATUS.SONG_SELECT:
                    length = 2;
                    break;
                case RUNNING_STATUS.SONG_POSITION_POINTER:
                    length = 3;
                    break;
            }
        }
        if (length === -1)
        {
            throw "Error: Unknown event type.";
        }
    },

    // The data2 and timeStamp arguments are optional. They both default to 0.
    Event = function (status, data1Arg, data2Arg, timestamp)
    {
        var dataValues, data1, data2;

        if (!(this instanceof Event))
        {
            if (arguments.length === 3)
            {
                return new Event(status, data1Arg, data2Arg);
            }
            if (arguments.length === 4)
            {
                return new Event(status, data1Arg, data2Arg, timestamp);
            }
        }

        dataValues = _getDataValues(arguments.length, data1Arg, data2Arg);

        data1 = dataValues.data1;
        data2 = dataValues.data2;

        _checkArgSizes(status, data1, data2);

        _length = _getLength(status);

        this.timestamp = _getTimestamp(arguments.length, timestamp);
        this.data = new Uint8Array(_length);

        switch (_length)
        {
            case 1:
                this.data[0] = status; // runtime events
                break;
            case 2:
                this.data[0] = status;
                this.data[1] = data1;
                break;
            case 3:
                this.data[0] = status;
                this.data[1] = data1;
                this.data[2] = data2;
                break;
        }
    },

    // SysExEvent constructor
    // data is an array of numbers,
    // timestamp is a (floating point) number representing the number of milliseconds
    // since the beginning of the file or performance.
    // An exception is thrown if:
    //     data.length is less than 3.
    //     any of the numbers in data is outside the range 0x00 to 0xFF,
    //     any of the numbers is not an "integer" (Math.floor() is used to check)
    //     data[0] is not SYSTEM_EXCLUSIVE.START (0xF0)
    //     data[data.length -1] is not SYSTEM_EXCLUSIVE.END (0xF7)
    SysExEvent = function (data, timestamp)
    {
        var i, dataLength = data.length;

        if (!(this instanceof SysExEvent))
        {
            return new SysExEvent(data, timestamp);
        }

        if (data.length < 3)
        {
            throw "Error: not enough data.\n";
        }
        if (data[0] !== SYSTEM_EXCLUSIVE.START)
        {
            throw "Error: System Exclusive data must begin with the value 0xF0";
        }
        if (data[data.length - 1] !== SYSTEM_EXCLUSIVE.END)
        {
            throw "Error: System Exclusive data must end with the value 0xF7";
        }
        for (i = 0; i < dataLength; ++i)
        {
            if ((data[i] < 0 || data[i] > 0xFF)
            || (Math.floor(data[i]) !== data[i]))
            {
                throw "Error: System exclusive data may only contain integers in the range 0 to 0xFF";
            }
        }

        this.data = new Uint8Array(data);

        this.timestamp = timestamp;
    },

    // Returns either a SysExEvent or a Event, depending on the data.
    // data is an array of numbers in range 0..0xF0. Exceptions are thrown
    // An exception will be thrown if the data is in any way illegal. 
    getEvent = function (data)
    {
        var inputEvent;

        function isRunningStatus (constant)
        {
            var result = false;

            if ((constant === RUNNING_STATUS.MTC_QUARTER_FRAME)
            || (constant === RUNNING_STATUS.SONG_POSITION_POINTER)
            || (constant === RUNNING_STATUS.SONG_SELECT)
            || (constant === RUNNING_STATUS.TUNE_REQUEST)
            || (constant === RUNNING_STATUS.MIDI_CLOCK)
            || (constant === RUNNING_STATUS.MIDI_TICK)
            || (constant === RUNNING_STATUS.MIDI_START)
            || (constant === RUNNING_STATUS.MIDI_CONTINUE)
            || (constant === RUNNING_STATUS.MIDI_STOP)
            || (constant === RUNNING_STATUS.ACTIVE_SENSE)
            || (constant === RUNNING_STATUS.RESET))
            {
                result = true;
            }
            return result;
        }

        if (data[0] === SYSTEM_EXCLUSIVE.START)
        {
            if (data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END)
            {
                inputEvent = new SysExEvent(data, window.performance.now());
            }
            else
            {
                throw "Error in System Exclusive event.";
            }
        }
        else if ((data[0] & 0xF0) === 0xF0)
        {
            if (isRunningStatus(data[0]))
            {
                inputEvent = new Event(data[0], 0, 0, window.performance.now());
            }
            else
            {
                throw "Error: illegal input event.";
            }
        }
        else if (data.length === 2)
        {
            inputEvent = new Event(data[0], data[1], 0, window.performance.now());
        }
        else if (data.length === 3)
        {
            inputEvent = new Event(data[0], data[1], data[2], window.performance.now());
        }
        else
        {
            throw "Error: illegal input event.";
        }
        return inputEvent;
    },

    // Returns an object having two attributes: data1 and data2, which are
    // the lsb and msb respectively of the dataValue converted to 14-bit.
    // This function is used to calculate the data1 and data2 arguments
    // to a pitch wheel Event constructor.
    to14Bit = function (dataValue)
    {
        var values, inBuffer, inDV, outBuffer, outDV, inData;

        // According to the docs,
        //     the minimum PITCH_WHEEL value is 0
        //     the maximum PITCH_WHEEL value is 16383 (0x3FFF)
        // centre value (0 deviation) is at 8192 (0x2000)
        if (dataValue < 0 || dataValue > 16383)
        {
            throw "Error: PITCH_WHEEL value out of range.";
        }
        inBuffer = new ArrayBuffer(2);
        inDV = new DataView(inBuffer);
        outBuffer = new ArrayBuffer(2);
        outDV = new DataView(outBuffer);

        inDV.setUint16(0, dataValue);
        inData = inDV.getUint16(0);

        outDV.setUint8(1, inData & 0x7F); // lsb = data1
        outDV.setUint8(0, ((inData >> 7) & 0x7F)); // msb = data2

        values.data1 = outDV[1]; // lsb = data1
        values.data2 = outDV[0]; // msb = data2

        return values;
    },

    // Returns the 14-bit numeric value which results from combining the two
    // 7-bit arguments. data1 is the lsb, data2 is the msb.
    from14Bit = function (data1, data2)
    {
        var returnValue, inBuffer, inDV, outBuffer, outDV, inData;

        if (data1 < 0 || data1 > 0x7F)
        {
            throw "Error: data1 value out of range.";
        }
        if (data2 < 0 || data2 > 0x7F)
        {
            throw "Error: data2 value out of range.";
        }
        inBuffer = new ArrayBuffer(1);
        inDV = new DataView(inBuffer);
        outBuffer = new ArrayBuffer(2);
        outDV = new DataView(outBuffer);

        inDV.setUint8(0, (data2 & 0x7F));

        outDV.setUint8(1, data1 & 0x7F); // lsb = data1
        outDV.setUint8(0, ((inData[0] << 7) & 0x7F)); // msb = data2

        returnValue = outDV.getUint16(0);

        return returnValue;
    },


    API =
    {
        // objects containing MIDI constants
        COMMAND: COMMAND,
        RUNNING_STATUS: RUNNING_STATUS,
        CONTROL: CONTROL,
        SYSTEM_EXCLUSIVE: SYSTEM_EXCLUSIVE,
        // constructors
        Event: Event,
        SysExEvent: SysExEvent,
        // functions
        getEvent: getEvent, // factory: returns Event or SysExEvent
        to14Bit: to14Bit,
        from14Bit: from14Bit
    };

    Event.prototype.status = function ()
    {
        return this.data[0];
    };

    Event.prototype.isaCommand = function (command)
    {
        var isa = false;

        if ((command === COMMAND.NOTE_OFF)
        || (command === COMMAND.NOTE_ON)
        || (command === COMMAND.POLY_AFTERTOUCH)
        || (command === COMMAND.CONTROL_CHANGE)
        || (command === COMMAND.PROGRAM_CHANGE)
        || (command === COMMAND.CHANNEL_AFTERTOUCH)
        || (command === COMMAND.PITCH_WHEEL)
        || (command === COMMAND.NOTE_OFF))
        {
            isa = true;
        }

        return isa;
    };

    // returns a COMMAND constant or -1. 
    Event.prototype.command = function ()
    {
        var returnValue = this.data[0] & 0xF0;

        if (!this.isaCommand(returnValue))
        {
            returnValue = -1;
        }
        return;
    };

    Event.prototype.channel = function ()
    {
        return this.data[0] & 0x0F;
    };

    Event.prototype.hasData1 = function ()
    {
        var returnValue = true;
        if (this.data.length < 2)
        {
            returnValue = false;
        }
        return returnValue;
    };

    // Returns -1 if the Event has no data1 attribute.
    Event.prototype.data1 = function ()
    {
        var returnValue = -1;

        if (this.data.length > 1)
        {
            returnValue = this.data[1];
        }
        return returnValue;
    };

    Event.prototype.hasData2 = function ()
    {
        var returnValue = true;
        if (this.data.length < 3)
        {
            returnValue = false;
        }
        return returnValue;
    };

    // Returns -1 if the Event has no data2 attribute.
    Event.prototype.data2 = function ()
    {
        var returnValue = -1;

        if (this.data.length > 2)
        {
            returnValue = this.data[2];
        }

        return returnValue;
    };


    Event.prototype.clone = function ()
    {
        var clone;
        switch (this.data.length)
        {
            case 1:
                clone = new Event(this.data[0], 0, 0, this.timestamp);
                break;
            case 2:
                clone = new Event(this.data[0], this.data[1], 0, this.timestamp);
                break;
            case 3:
                clone = new Event(this.data[0], this.data[1], this.data[2], this.timestamp);
                break;
        }
        return clone;
    };

    // timestamps are rounded to 6 decimal places.
    Event.prototype.toString = function ()
    {
        var 
        returnString = "Unknown EventType.";

        if (this.data.length === 1)
        {
            switch (this.data[0])
            {
                case RUNNING_STATUS.TUNE_REQUEST:
                    returnString = "RUNNING_STATUS.TUNE_REQUEST ( " + RUNNING_STATUS.TUNE_REQUEST.toString(16) + " )";
                    break;
                case RUNNING_STATUS.MIDI_CLOCK:
                    returnString = "RUNNING_STATUS.MIDI_CLOCK ( " + RUNNING_STATUS.MIDI_CLOCK.toString(16) + " )";
                    break;
                case RUNNING_STATUS.MIDI_TICK:
                    returnString = "RUNNING_STATUS.MIDI_TICK ( " + RUNNING_STATUS.MIDI_TICK.toString(16) + " )";
                    break;
                case RUNNING_STATUS.MIDI_START:
                    returnString = "RUNNING_STATUS.MIDI_START ( " + RUNNING_STATUS.MIDI_START.toString(16) + " )";
                    break;
                case RUNNING_STATUS.MIDI_CONTINUE:
                    returnString = "RUNNING_STATUS.MIDI_CONTINUE ( " + RUNNING_STATUS.MIDI_CONTINUE.toString(16) + " )";
                    break;
                case RUNNING_STATUS.MIDI_STOP:
                    returnString = "RUNNING_STATUS.MIDI_STOP ( " + RUNNING_STATUS.MIDI_STOP.toString(16) + " )";
                    break;
                case RUNNING_STATUS.ACTIVE_SENSE:
                    returnString = "RUNNING_STATUS.ACTIVE_SENSE ( " + RUNNING_STATUS.ACTIVE_SENSE.toString(16) + " )";
                    break;
                case RUNNING_STATUS.RESET:
                    returnString = "RUNNING_STATUS.RESET ( " + RUNNING_STATUS.RESET.toString(16) + " )";
                    break;
            }

            returnString.concat(' timestamp:' + this.timestamp.toFixed(6));   
        }
        else if (this.data.length === 2)
        {
            switch (this.command())
            {
                case -1:
                    switch (this.data[0])
                    {
                        case RUNNING_STATUS.MTC_QUARTER_FRAME:
                            returnString = 'realtime: MTC_QUARTER_FRAME';
                            break;
                        case RUNNING_STATUS.SONG_SELECT:
                            returnString = 'realtime: SONG_SELECT';
                            break;
                    }
                    break;
                case COMMAND.CHANNEL_AFTERTOUCH:
                    returnString = 'command: CHANNEL_AFTERTOUCH, channel:' + this.channel().toString();
                    break;
                case COMMAND.PROGRAM_CHANGE:
                    returnString = 'command: PROGRAM_CHANGE, channel:' + this.channel().toString();
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
                                ' timestamp:' + this.timestamp.toFixed(6));
        }
        else if (this.data.length === 3)
        {
            switch (this.command())
            {
                case -1:
                    returnString = 'realtime: SONG_POSITION_POINTER';
                    break;

                case COMMAND.NOTE_OFF:
                    returnString = 'command: NOTE_OFF, channel:' + this.channel().toString();
                    break;
                case COMMAND.NOTE_ON:
                    returnString = 'command: NOTE_ON, channel:' + this.channel().toString();
                    break;
                case COMMAND.POLY_AFTERTOUCH:
                    returnString = 'command: POLY_AFTERTOUCH, channel:' + this.channel().toString();
                    break;
                case COMMAND.CONTROL_CHANGE:
                    returnString = 'command: CONTROL_CHANGE, channel:' + this.channel().toString();
                    break;
                case COMMAND.PITCH_WHEEL:
                    returnString = 'command: PITCH_WHEEL, channel:' + this.channel().toString();
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
                                ' data2:' + this.data[2].toString(16) + " (" + this.data[2].toString() + ")" +
                                ' timestamp:' + this.timestamp.toFixed(6));
        }
        return returnString;
    };

    // returns the timestamp (rounded to 4 decimal places) followed by a string of hexadecimal numbers.
    SysExEvent.prototype.toString = function ()
    {
        var i,
        dataLength = this.data.length,
        returnString = "SysEx: timestamp:" + this.timestamp.toFixed(4) + " data:";

        for (i = 0; i < dataLength; ++i)
        {
            returnString = returnString.concat(this.data[i].toString(16) + " ");
        }
    };

    return API;

} (window));

    
