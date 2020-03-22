
import { constants } from "./Constants.js";

export class Message
{
	// This is the constructor to use for non-SysExMessages having 1, 2 or 3 data bytes.
	// A 1-byte "realTime" message will be constructed if data.length is 1, and data[0]
	// matches one of the appropriate REAL_TIME values. 
	// The data1Arg and data2Arg arguments are optional and default to 0.
	constructor(status, data1Arg = 0, data2Arg = 0)
	{
		this._getLength = function(status)
		{
			var length = -1, command = status & 0xF0, COMMAND = constants.COMMAND, SYSTEM_EXCLUSIVE = constants.SYSTEM_EXCLUSIVE, REAL_TIME = constants.REAL_TIME;

			switch(command)
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
			if(length === -1)
			{
				switch(status)
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
			if(length === -1)
			{
				throw "Error: Unknown message type.";
			}
			return length;
		};
		let dataValues = this._getDataValues(arguments.length, data1Arg, data2Arg);
		let data1 = dataValues.data1, data2 = dataValues.data2;
		this._checkArgSizes(status, data1, data2);
		length = this._getLength(status);
		this.data = new Uint8Array(length);
		switch(length)
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
	}

	command()
	{
		return this.data[0] & 0xF0;
	}
	channel()
	{
		return this.data[0] & 0xF;
	}
	data1()
	{
		return this.data[1];
	}
	clone()
	{
		var clone;
		switch(this.data.length)
		{
			case 1:
				clone = new Message(this.data[0]); // runtime messages
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
	}
	toString()
	{
		let returnString = "Unknown Message Type.", channel, COMMAND = constants.COMMAND, REAL_TIME = constants.REAL_TIME,
			data = this.data;

		if(data.length === 1)
		{
			switch(data[0])
			{
				case REAL_TIME.TUNE_REQUEST:
					returnString = "REAL_TIME.TUNE_REQUEST (0x" + REAL_TIME.TUNE_REQUEST.toString(16) + " )";
					break;
				case REAL_TIME.MIDI_CLOCK:
					returnString = "REAL_TIME.MIDI_CLOCK (0x" + REAL_TIME.MIDI_CLOCK.toString(16) + " )";
					break;
				case REAL_TIME.MIDI_TICK:
					returnString = "REAL_TIME.MIDI_TICK (0x" + REAL_TIME.MIDI_TICK.toString(16) + " )";
					break;
				case REAL_TIME.MIDI_START:
					returnString = "REAL_TIME.MIDI_START (0x" + REAL_TIME.MIDI_START.toString(16) + " )";
					break;
				case REAL_TIME.MIDI_CONTINUE:
					returnString = "REAL_TIME.MIDI_CONTINUE (0x" + REAL_TIME.MIDI_CONTINUE.toString(16) + " )";
					break;
				case REAL_TIME.MIDI_STOP:
					returnString = "REAL_TIME.MIDI_STOP (0x" + REAL_TIME.MIDI_STOP.toString(16) + " )";
					break;
				case REAL_TIME.ACTIVE_SENSE:
					returnString = "REAL_TIME.ACTIVE_SENSE (0x" + REAL_TIME.ACTIVE_SENSE.toString(16) + " )";
					break;
				case REAL_TIME.RESET:
					returnString = "REAL_TIME.RESET (0x" + REAL_TIME.RESET.toString(16) + " )";
					break;
			}
		}
		else if(data.length === 2)
		{
			channel = (data[0] & 0xF).toString();
			switch(data[0] & 0xF0)
			{
				case 0xF0:
					switch(data[0])
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
			returnString = returnString.concat(' data1:0x' + data[1].toString(16) + " (" + data[1].toString() + ")");
		}
		else if(data.length === 3)
		{
			channel = (data[0] & 0xF).toString();
			switch(data[0] & 0xF0)
			{
				case 0xF0:
					returnString = `realtime: SONG_POSITION_POINTER, channel:${channel} data[1]:${data[1]} data[2]:${data[2]}`;
					break;
				case COMMAND.NOTE_OFF:
					returnString = `command: NOTE_OFF, channel:${channel} note:${data[1]} velocity:${data[1]}`;
					break;
				case COMMAND.NOTE_ON:
					returnString = `command: NOTE_ON, channel:${channel} note:${data[1]} velocity:${data[1]}`;
					break;
				case COMMAND.AFTERTOUCH:
					returnString = `command: AFTERTOUCH, channel:${channel} data[1]:${data[1]} data[2]:${data[2]}`;
					break;
				case COMMAND.CONTROL_CHANGE:
					let CC = constants.CONTROL,
						control = data[1];
					switch(control)
					{
						case CC.MODWHEEL: // 1,
							returnString = `control:1 (modwheel) channel:${channel} value:${data[2]}`;
							break;
						case CC.DATA_ENTRY_COARSE:// 6,
							returnString = `control:1 (dataEntryCoarse) channel:${channel} value:${data[2]}`;
							break;							
						case CC.VOLUME:// 7,
							returnString = `control:1 (volume) channel:${channel} value:${data[2]}`;
							break;							
						case CC.PAN:// 10,
							returnString = `control:10 (pan) channel:${channel} value:${data[2]}`;
							break;							
						case CC.EXPRESSION:// 11,
							returnString = `control:11 (expression) channel:${channel} value:${data[2]}`;
							break;							
						case CC.TIMBRE:// 71,
							returnString = `control:71 (timbre) channel:${channel} value:${data[2]}`;
							break;							
						case CC.BRIGHTNESS:// 74,
							returnString = `control:74 (brightness) channel:${channel} value:${data[2]}`;
							break;							
						case CC.EFFECTS: // 91,
							returnString = `control:91 (effects) channel:${channel} value:${data[2]}`;
							break;							
						case CC.TREMOLO:// 92,
							returnString = `control:92 (tremolo) channel:${channel} value:${data[2]}`;
							break;							
						case CC.CHORUS:// 93,
							returnString = `control:93 (chorus) channel:${channel} value:${data[2]}`;
							break;							
						case CC.CELESTE:// 94,
							returnString = `control:94 (celeste) channel:${channel} value:${data[2]}`;
							break;							
						case CC.PHASER:// 95,
							returnString = `control:95 (phaser) channel:${channel} value:${data[2]}`;
							break;							
						case CC.REGISTERED_PARAMETER_COARSE:// 101,
							returnString = `control:101 (registeredParameterCoarse) channel:${channel} value:${data[2]}`;
							break;							
						case CC.ALL_SOUND_OFF: // 120,
							returnString = `control:120 (allSoundOff) channel:${channel} value:${data[2]}`;
							break;							
						case CC.ALL_CONTROLLERS_OFF:// 121,
							returnString = `control:121 (allControllersOff) channel:${channel} value:${data[2]}`;
							break;							
						case CC.ALL_NOTES_OFF:// 123
							returnString = `control:123 (allNotesOff) channel:${channel} value:${data[2]}`;
							break;
						default:
							returnString = `unsupported control (index ${data[1]}) channel:${channel} value:${data[2]}`;
							break;														
					}
					break;
				case COMMAND.PITCH_WHEEL:
					let combinedValue = constants.pitchwheelCombinedValue(data[1], data[2]);
					returnString = `command: PITCH_WHEEL, channel:${channel} data[1]:${data[1]} data[2]:${data[2]} (combinedValue:${combinedValue})`;
					break;
			}
		}
		return returnString;
	}

	_getDataValues(argsLength, data1Arg, data2Arg)
	{
		var values = { data1: 0, data2: 0, data3: 0 };
		if(argsLength === 1)
		{
			values.data1 = 0;
			values.data2 = 0;
		}
		else if(argsLength === 2)
		{
			values.data1 = data1Arg;
			values.data2 = 0;
		}
		else if(argsLength === 3 || argsLength === 4)
		{
			values.data1 = data1Arg;
			values.data2 = data2Arg;
		}
		else
		{
			throw "Error: Too many arguments!";
		}
		return values;
	}
	_checkArgSizes(status, data1, data2)
	{
		if(status < 0 || status > 0xFF)
		{
			throw "Error: status out of range.";
		}
		if(data1 < 0 || data1 > 0x7F)
		{
			throw "Error: data1 out of range.";
		}
		if(data2 < 0 || data2 > 0x7F)
		{
			throw "Error: data2 out of range.";
		}
	}
}

