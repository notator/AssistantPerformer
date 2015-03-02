/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Message.js
 *  The _AP.message namespace which defines the following constructors:
 *
 *      // Constructs 1- 2- or 3-byte MIDI messages which are not SysExMessages.
 *      // 1-byte Messages are "real time".
 *      Message(status, data1, data2)
 *
 *      // Constructs system exclusive messages.
 *      SysExMessage(data)
 *
 *  Message prototype functions:
 *
 *      // The value of the command part of the status byte
 *      command()
 *
 *      // The value of the channel part of the status byte
 *      channel()
 *
 *      // A string of values, preceded by their descriptions.
 *      toString()
 *
 *  SysExMessage prototype function:
 *
 *      // returns "SysEx data:" followed by a string of
 *      // hexadecimal numbers separated by spaces.
 *      toString()
 */

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.message');

_AP.message = (function ()
{
    "use strict";
    var
    COMMAND = _AP.constants.COMMAND,
    REAL_TIME = _AP.constants.REAL_TIME,
    SYSTEM_EXCLUSIVE = _AP.constants.SYSTEM_EXCLUSIVE,

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

    _getLength = function (status)
    {
        var length = -1, command = status & 0xF0;

        switch (command)
        {
            case COMMAND.NOTE_OFF:
            case COMMAND.NOTE_ON:
            case COMMAND.AFTERTOUCH:
            case COMMAND.CONTROL_CHANGE:
            case COMMAND.PITCH_WHEEL:
                length = 3;
                break;
            case COMMAND.PROGRAM_CHANGE:
            case COMMAND.CHANNEL_PRESSURE:
                length = 2;
                break;
        }
        if (length === -1)
        {
            switch (status)
            {
                case SYSTEM_EXCLUSIVE.START:
                    throw "Error: Use the special SysExMessage constructor to construct variable length messages.";
                case REAL_TIME.TUNE_REQUEST:
                case REAL_TIME.MIDI_CLOCK:
                case REAL_TIME.MIDI_TICK:
                case REAL_TIME.MIDI_START:
                case REAL_TIME.MIDI_CONTINUE:
                case REAL_TIME.MIDI_STOP:
                case REAL_TIME.ACTIVE_SENSE:
                case REAL_TIME.RESET:
                    length = 1;
                    break;
                case REAL_TIME.MTC_QUARTER_FRAME:
                case REAL_TIME.SONG_SELECT:
                    length = 2;
                    break;
                case REAL_TIME.SONG_POSITION_POINTER:
                    length = 3;
                    break;
            }
        }

        if (length === -1)
        {
            throw "Error: Unknown message type.";
        }

        return length;
    },

    // This is the constructor to use for non-SysExMessages having 1, 2 or 3 data bytes.
    // A 1-byte "realTime" message will be constructed if data.length is 1, and data[0]
    // matches one of the appropriate REAL_TIME values. 
    // The data1Arg and data2Arg arguments are optional and default to 0.
    Message = function (status, data1Arg, data2Arg)
    {
        var dataValues, data1, data2;

        if (!(this instanceof Message))
        {
            if (arguments.length === 3)
            {
                return new Message(status, data1Arg, data2Arg);
            }
        }

        dataValues = _getDataValues(arguments.length, data1Arg, data2Arg);

        data1 = dataValues.data1;
        data2 = dataValues.data2;

        _checkArgSizes(status, data1, data2);

        _length = _getLength(status);

        this.data = new Uint8Array(_length);

        switch (_length)
        {
            case 1:
                this.data[0] = status; // runtime messages
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

    // SysExMessage constructor
    // data is an array of numbers in range 0x00 to 0xFF,
    // An exception is thrown if:
    //     data.length is less than 3.
    //     any of the numbers in data is outside the range 0x00 to 0xFF,
    //     any of the numbers in data is a realTime status byte.
    //     any of the numbers is not an "integer" (Math.floor() is used to check)
    //     data[0] is not SYSTEM_EXCLUSIVE.START (0xF0)
    //     data[data.length -1] is not SYSTEM_EXCLUSIVE.END (0xF7)
    SysExMessage = function (data)
    {
        var i, dataLength = data.length,
            isRealTimeStatus = _AP.constants.isRealTimeStatus;

        if (!(this instanceof SysExMessage))
        {
            return new SysExMessage(data);
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
            if (isRealTimeStatus(data[i]))
            {
                throw "Error: RealTime messages should be removed from data before calling this constructor";
            }
        }

        this.data = new Uint8Array(data);
    },

    API =
    {
        // constructors
        Message: Message,
        SysExMessage: SysExMessage
    };

    Message.prototype.command = function ()
    {
        return this.data[0] & 0xF0;
    };

    Message.prototype.channel = function()
    {
        return this.data[0] & 0xF;
    };

    Message.prototype.clone = function()
    {
        var clone;
        switch(this.data.length)
        {
            case 1:
                clone = new Message(this.data[0]);; // runtime messages
                break;
            case 2:
                clone = new Message(this.data[0], this.data[1]);
                break;
            case 3:
                clone = new Message(this.data[0], this.data[1], this.data[2]);
                break;
            default:
                throw "Error: cannot clone messages with more than 3 data bytes.";
        }
        return clone;
    };

    Message.prototype.toString = function ()
    {
        var 
        returnString = "Unknown Message Type.",
        channel;

        if (this.data.length === 1)
        {
            switch (this.data[0])
            {
                case REAL_TIME.TUNE_REQUEST:
                    returnString = "REAL_TIME.TUNE_REQUEST ( " + REAL_TIME.TUNE_REQUEST.toString(16) + " )";
                    break;
                case REAL_TIME.MIDI_CLOCK:
                    returnString = "REAL_TIME.MIDI_CLOCK ( " + REAL_TIME.MIDI_CLOCK.toString(16) + " )";
                    break;
                case REAL_TIME.MIDI_TICK:
                    returnString = "REAL_TIME.MIDI_TICK ( " + REAL_TIME.MIDI_TICK.toString(16) + " )";
                    break;
                case REAL_TIME.MIDI_START:
                    returnString = "REAL_TIME.MIDI_START ( " + REAL_TIME.MIDI_START.toString(16) + " )";
                    break;
                case REAL_TIME.MIDI_CONTINUE:
                    returnString = "REAL_TIME.MIDI_CONTINUE ( " + REAL_TIME.MIDI_CONTINUE.toString(16) + " )";
                    break;
                case REAL_TIME.MIDI_STOP:
                    returnString = "REAL_TIME.MIDI_STOP ( " + REAL_TIME.MIDI_STOP.toString(16) + " )";
                    break;
                case REAL_TIME.ACTIVE_SENSE:
                    returnString = "REAL_TIME.ACTIVE_SENSE ( " + REAL_TIME.ACTIVE_SENSE.toString(16) + " )";
                    break;
                case REAL_TIME.RESET:
                    returnString = "REAL_TIME.RESET ( " + REAL_TIME.RESET.toString(16) + " )";
                    break;
            }
        }
        else if (this.data.length === 2)
        {
            channel = (this.data[0] & 0xF).toString();
            switch (this.data[0] & 0xF0)
            {
                case 0xF0:
                    switch (this.data[0])
                    {
                        case REAL_TIME.MTC_QUARTER_FRAME:
                            returnString = 'realtime: MTC_QUARTER_FRAME';
                            break;
                        case REAL_TIME.SONG_SELECT:
                            returnString = 'realtime: SONG_SELECT';
                            break;
                    }
                    break;
                case COMMAND.CHANNEL_PRESSURE:
                    returnString = 'command: CHANNEL_PRESSURE, channel:' + channel;
                    break;
                case COMMAND.PROGRAM_CHANGE:
                    returnString = 'command: PROGRAM_CHANGE, channel:' + channel;
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")");
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
                case COMMAND.AFTERTOUCH:
                    returnString = 'command: AFTERTOUCH, channel:' + channel;
                    break;
                case COMMAND.CONTROL_CHANGE:
                    returnString = 'command: CONTROL_CHANGE, channel:' + channel;
                    break;
                case COMMAND.PITCH_WHEEL:
                    returnString = 'command: PITCH_WHEEL, channel:' + channel;
                    break;
            }
            returnString.concat(' data1:' + this.data[1].toString(16) + " (" + this.data[1].toString() + ")" +
                                ' data2:' + this.data[2].toString(16) + " (" + this.data[2].toString() + ")");
        }
        return returnString;
    };

    // returns "SysEx data:" followed by a string of hexadecimal numbers.
    SysExMessage.prototype.toString = function ()
    {
        var i,
        dataLength = this.data.length,
        returnString = "SysEx data:";

        for (i = 0; i < dataLength; ++i)
        {
            returnString = returnString.concat(this.data[i].toString(16) + " ");
        }
    };

    return API;

} ());

    
