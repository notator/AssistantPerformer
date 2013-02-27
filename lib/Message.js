/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  lib/Message.js
 *  The MIDILib.message namespace which defines
 *      1. Message(status, data1, data2) for constructing 1- 2- or 3-byte MIDI messages
 *         which are not SysExMessages. 1-byte Messages are "running status".
 *      2. SysExMessage(data) for explicitly constructing system exclusive messages.
 *      3. function getInputEvent(data, now) for use when reading an input stream.
 *          The returned object has .data and .receivedTime attributes, and so constitutes a
 *          timestamped Message. (The Web MIDI API currently calls this object an Event)
 *      4. the functions to14Bit(value) and from14Bit(data1, data2), for dealing with PITCH_WHEEL
 *         messages.  
 *
 *  Message constructor
 *          Message(status, data1, data2)
 *  This constructor is for all message types except SYSTEM_EXCLUSIVE (see special constructor below).
 *  The data1 and data2 arguments are optional and default to 0.
 *  An exception is thrown if status, data1 and data2 are not in range 0x00 to 0xFF, or are otherwise
 *  illegal.
 *
 *  SysExMessage constructor
 *          SysExMessage(dataArray)
 *  The dataArray is an ordinary Javascript array of numbers in the range 0x0 to 0xFF.
 *  dataArray[0] must be 0xF0, dataArray[dataArray.length - 1] must be 0xF7.
 *
 */

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

MIDILib.namespace('MIDILib.message');

MIDILib.message = (function ()
{
    "use strict";
    var
    COMMAND = MIDILib.constants.COMMAND,
    RUNNING_STATUS = MIDILib.constants.RUNNING_STATUS,
    SYSTEM_EXCLUSIVE = MIDILib.constants.SYSTEM_EXCLUSIVE,

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
            throw "Error: Unknown message type.";
        }

        return length;
    },

    // This is the constructor to use for non-SysExMessages having 1, 2 or 3 data bytes.
    // A 1-byte "running status" message will be constructed if data.length is 1, and data[0]
    // matches one of the RUNNING_STATUS values. 
    // When reading an input stream, use the factory function getInputEvent(data, now) see below.
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
    //     any of the numbers is not an "integer" (Math.floor() is used to check)
    //     data[0] is not SYSTEM_EXCLUSIVE.START (0xF0)
    //     data[data.length -1] is not SYSTEM_EXCLUSIVE.END (0xF7)
    SysExMessage = function (data)
    {
        var i, dataLength = data.length;

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
        }

        this.data = new Uint8Array(data);
    },

    // Use this function when reading an input stream.
    // The returned object has .data and .receivedTime attributes, and so constitutes a
    // timestamped Message. (Web MIDI API simply calls this an Event)
    // If the input data is undefined, an empty object is returned, otherwise data must
    // be an array of numbers in range 0..0xF0. An exception is thrown if the data is illegal.
    // The returned .data attribute can be a 1, 2 or 3-byte Message, or a SysExMessage
    // depending on the input data.
    getInputEvent = function (data, now)
    {
        var inputEvent;

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
            inputEvent = {};
        }
        else if (data[0] === SYSTEM_EXCLUSIVE.START)
        {
            if (data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END)
            {
                inputEvent = new SysExMessage(data);
            }
            else
            {
                throw "Error in System Exclusive inputEvent.";
            }
        }
        else if ((data[0] & 0xF0) === 0xF0)
        {
            if (isRunningStatus(data[0]))
            {
                inputEvent = new Message(data[0], 0, 0);
            }
            else
            {
                throw "Error: illegal data.";
            }
        }
        else if (data.length === 2)
        {
            inputEvent = new Message(data[0], data[1], 0);
        }
        else if (data.length === 3)
        {
            inputEvent = new Message(data[0], data[1], data[2]);
        }
        else
        {
            throw "Error: illegal data.";
        }

        if (data !== undefined && data.length > 0)
        {
            inputEvent.receivedTime = now;
        }

        return inputEvent;
    },

    // Returns an object having two attributes: data1 and data2, which are
    // the lsb and msb respectively of the argument converted to 14-bit.
    // This function is used to calculate the data1 and data2 arguments
    // to a pitch wheel Message constructor.
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

        values.data1 = outDV.getUint8(0); // lsb = data1
        values.data2 = outDV.getUint8(1); // msb = data2

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

        outDV.setUint8(0, data1 & 0x7F); // msb = data2
        outDV.setUint8(1, ((inData[0] << 7) & 0x7F));// lsb = data1 

        returnValue = outDV.getUint16(0);

        return returnValue;
    },

    API =
    {
        // constructors
        Message: Message,
        SysExMessage: SysExMessage,
        // functions
        getInputEvent: getInputEvent,
        to14Bit: to14Bit,
        from14Bit: from14Bit
    };

    Message.prototype.command = function ()
    {
        return this.data[0] & 0xF0;
    };

    Message.prototype.channel = function ()
    {
        return this.data[0] & 0xF;
    };

    Message.prototype.isaCommand = function (command)
    {
        var isa = false;

        if ((command === COMMAND.NOTE_OFF)
        || (command === COMMAND.NOTE_ON)
        || (command === COMMAND.AFTERTOUCH)
        || (command === COMMAND.CONTROL_CHANGE)
        || (command === COMMAND.PROGRAM_CHANGE)
        || (command === COMMAND.CHANNEL_PRESSURE)
        || (command === COMMAND.PITCH_WHEEL)
        || (command === COMMAND.NOTE_OFF))
        {
            isa = true;
        }

        return isa;
    };

    Message.prototype.clone = function ()
    {
        var clone;
        switch (this.data.length)
        {
            case 1:
                clone = new Message(this.data[0], 0, 0);
                break;
            case 2:
                clone = new Message(this.data[0], this.data[1], 0);
                break;
            case 3:
                clone = new Message(this.data[0], this.data[1], this.data[2]);
                break;
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

    
