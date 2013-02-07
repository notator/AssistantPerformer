/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  lib/Event.js
 *  The MIDI_API.event namespace which defines
 *      1. Event(status, data1, data2, timestamp) for constructing 1- 2- or 3-byte MIDI events
 *         which are not SysExEvents. 1-byte Events are "running status".
 *      2. SysExEvent(data, timestamp) for explicitly constructing system exclusive events.
 *      3. function getEvent(data, timestamp) for constructing any kind of event. This function
 *         can be used to construct events when their type is not known in advance (e.g. when
 *         reading an input stream). Note that the timestamp argument is relative to some fixed
 *         time. It is not, as in standard MIDI files, relative to the previous event. 
 *      4. the functions to14Bit(value) and from14Bit(data1, data2), for dealing with PITCH_WHEEL
 *         events.  
 *
 *  Event constructor
 *          Event(status, data1, data2, timestamp)
 *  This constructor is for all event types except SYSTEM_EXCLUSIVE (see special constructor below).
 *  The data1, data2 and timestamp arguments are optional. They all default to 0.
 *  An exception is thrown if status, data1 and data2 are not in range 0x00 to 0xFF, or are otherwise
 *  illegal.
 *  timestamp is the (floating point) number of milliseconds from the start of the performance.
 *  An exception is thrown if timestamp is negative.
 *
 *  SysExEvent constructor
 *          SysExEvent(dataArray, timestamp)
 *  The dataArray is an ordinary Javascript array of numbers in the range 0x0 to 0xFF.
 *  dataArray[0] must be 0xF0, dataArray[dataArray.length - 1] must be 0xF7.
 *
 *  All Event types have the same public interface (Web MIDI API MIDIEvent):
 *      data // Uint8Array
 *      timestamp // DOMHighResTimeStamp (a double -- an ordinary Javascript Number)
 */

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

MIDI_API.namespace('MIDI_API.event');

MIDI_API.event = (function ()
{
    "use strict";
    var
    COMMAND = MIDI_API.constants.COMMAND,
    RUNNING_STATUS = MIDI_API.constants.RUNNING_STATUS,
    SYSTEM_EXCLUSIVE = MIDI_API.constants.SYSTEM_EXCLUSIVE,

    _length,

    _getDataValues = function (argsLength, data1Arg, data2Arg)
    {
        var values = {};

        if (argsLength === 1)
        {
            values.data1 = 0;
            values.data2 = 0;
        }
        else if (argsLength === 2)
        {
            values.data1 = data1Arg;
            values.data2 = 0;
        }
        else if (argsLength === 3 || argsLength === 4)
        {
            values.data1 = data1Arg;
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

        return length;
    },

    // This is the constructor to use for non-SysExEvents having 1, 2 or 3 data bytes.
    // A 1-byte "running status" event will be constructed if data.length is 1, and data[0]
    // matches one of the RUNNING_STATUS values. 
    // Use the factory function getEvent(data, timestamp) if the event type is unknown in
    // advance (for example when reading an input stream).
    // getEvent() can create SysEx and "running data" events too.
    // The data1Arg, data2Arg and timeStamp arguments are all optional. They default to 0.
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
    // data is an array of numbers in range 0x00 to 0xFF,
    // timestamp is any positive (floating point) number.
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

    // Returns either an isEmpty, a 1, 2 or 3-byte Event, or a SysExEvent, depending on the data.
    // An exception will be thrown if the data is illegal.
    // data is an array of numbers in range 0..0xF0.
    // timestamp is any number (e.g. window.performance.now()).
    // Note that if this function is being used while reading an input stream, all the
    // timestamp arguments should be relative to some fixed time (usually the start of a performance).
    // They are not, as in Standard MIDI Files, relative to the previous event.
    getEvent = function (data, timestamp)
    {
        var event;

        function isRunningStatus(constant)
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

        if (data === undefined)
        {
            event = {};
            event.timestamp = timestamp;
            event.isEmpty = true;
        }
        else if (data[0] === SYSTEM_EXCLUSIVE.START)
        {
            if (data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END)
            {
                event = new SysExEvent(data, timestamp);
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
                event = new Event(data[0], 0, 0, timestamp);
            }
            else
            {
                throw "Error: illegal data.";
            }
        }
        else if (data.length === 2)
        {
            event = new Event(data[0], data[1], 0, timestamp);
        }
        else if (data.length === 3)
        {
            event = new Event(data[0], data[1], data[2], timestamp);
        }
        else
        {
            throw "Error: illegal data.";
        }
        return event;
    },

    // Returns an object having two attributes: data1 and data2, which are
    // the lsb and msb respectively of the argument converted to 14-bit.
    // This function is used to calculate the data1 and data2 arguments
    // to a pitch wheel Event constructor.
    // The argument is in range 0..16383, for the full range of pitchwheel values.
    // According to the docs,
    //     the minimum PITCH_WHEEL value is 0
    //     the maximum PITCH_WHEEL value is 16383 (0x3FFF)
    //     centre value (0 deviation) is at 8192 (0x2000)
    to14Bit = function (pitchwheelValue)
    {
        var
        inBuffer, inDV, outBuffer, outDV, inData,
        values = {};

        if (pitchwheelValue < 0 || pitchwheelValue > 16383)
        {
            throw "Error: pitchwheelValue out of range.";
        }

        inBuffer = new ArrayBuffer(2);
        inDV = new DataView(inBuffer);
        outBuffer = new ArrayBuffer(2);
        outDV = new DataView(outBuffer);

        inDV.setUint16(0, pitchwheelValue);
        inData = inDV.getUint16(0);

        outDV.setUint8(0, ((inData >> 7) & 0x7F)); // msb = data2
        outDV.setUint8(1, inData & 0x7F); // lsb = data1

        values.data2 = outDV.getUint8(0); // msb = data2
        values.data1 = outDV.getUint8(1); // lsb = data1

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
        // constructors
        Event: Event,
        SysExEvent: SysExEvent,
        // functions
        getEvent: getEvent,
        to14Bit: to14Bit,
        from14Bit: from14Bit
    };

    Event.prototype.command = function ()
    {
        return this.data[0] & 0xF0;
    };

    Event.prototype.channel = function ()
    {
        return this.data[0] & 0xF;
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

    // timestamps are rounded to 4 decimal places.
    Event.prototype.toString = function ()
    {
        var 
        returnString = "Unknown Event Type.",
        channel;

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

            returnString.concat(' timestamp:' + this.timestamp.toFixed(4));
        }
        else if (this.data.length === 2)
        {
            channel = (this.data[0] & 0xF).toString();
            switch (this.data[0] & 0xF0)
            {
                case 0xF0:
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
                    returnString = 'command: CHANNEL_AFTERTOUCH, channel:' + channel;
                    break;
                case COMMAND.PROGRAM_CHANGE:
                    returnString = 'command: PROGRAM_CHANGE, channel:' + channel;
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
                                ' timestamp:' + this.timestamp.toFixed(4));
        }
        else if (this.data.length === 3)
        {
            channel = (this.data[0] & 0xF).toString();
            switch (this.data[0] & 0xF0)
            {
                case 0xF0:
                    returnString = 'realtime: SONG_POSITION_POINTER';
                    break;
                case COMMAND.NOTE_OFF:
                    returnString = 'command: NOTE_OFF, channel:' + channel;
                    break;
                case COMMAND.NOTE_ON:
                    returnString = 'command: NOTE_ON, channel:' + channel;
                    break;
                case COMMAND.POLY_AFTERTOUCH:
                    returnString = 'command: POLY_AFTERTOUCH, channel:' + channel;
                    break;
                case COMMAND.CONTROL_CHANGE:
                    returnString = 'command: CONTROL_CHANGE, channel:' + channel;
                    break;
                case COMMAND.PITCH_WHEEL:
                    returnString = 'command: PITCH_WHEEL, channel:' + channel;
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
                                ' data2:' + this.data[2].toString(16) + " (" + this.data[2].toString() + ")" +
                                ' timestamp:' + this.timestamp.toFixed(4));
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

} ());

    
