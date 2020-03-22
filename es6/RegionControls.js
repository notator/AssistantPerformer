import { constants } from "./Constants.js";
import { Message } from "./Message.js";

const
	Cmd = constants.COMMAND,

	CtlALL_CONTROLLERS_OFF = constants.CONTROL.ALL_CONTROLLERS_OFF,
	CtlALL_SOUND_OFF = constants.CONTROL.ALL_SOUND_OFF;

// This class is used when setting the inital control commands for each region.
// These commands are sent whenever a performance of the region begins. 
export class RegionControls
{
	constructor(channelIndex)
	{
		let status = Cmd.CONTROL_CHANGE + channelIndex,
			allSoundOffMessage = new Message(status, CtlALL_SOUND_OFF),
			allControllersOffMessage = new Message(status, CtlALL_CONTROLLERS_OFF);

		Object.defineProperty(this, "aftertouchMessage", { value: null, writable: true });
		Object.defineProperty(this, "programChangeMessage", { value: null, writable: true });
		Object.defineProperty(this, "channelPressureMessage", { value: null, writable: true });
		Object.defineProperty(this, "pitchWheelMessage", { value: null, writable: true });
		Object.defineProperty(this, "controlMessages", { value: [allControllersOffMessage, allSoundOffMessage], writable: false });
	}

	// Set the corresponding currentControls values to the specific values in the moment messages.
	// (Leave the other values as they are.)
	// This function must also be called on the first moment in each region before updating it -- with update(moment).
	updateFrom(moment)
	{
		// returns the index of the particular control type in the controlMessages array or -1.
		function findControlMessage(controlType, controlMessages)
		{
			let returnIndex = -1, i, nMsgs = controlMessages.length;
			for(i = 0; i < nMsgs; ++i)
			{
				if(controlMessages[i].data1() === controlType)
				{
					returnIndex = i;
					break;
				}
			}
			return returnIndex;
		}

		for(let msg of moment.messages)
		{
			let cmd = msg.command();
			switch(cmd)
			{
				case Cmd.NOTE_OFF:
					// ignore
					break;
				case Cmd.NOTE_ON:
					// ignore
					break;
				case Cmd.AFTERTOUCH:
					this.aftertouchMessage = msg;
					break;
				case Cmd.CONTROL_CHANGE:
					let index = findControlMessage(msg.data1(), this.controlMessages);
					if(index < 0)
					{
						this.controlMessages.push(msg);
					}
					else
					{
						this.controlMessages[index] = msg;
					}
					break;
				case Cmd.PROGRAM_CHANGE:
					this.programChangeMessage = msg;
					break;
				case Cmd.CHANNEL_PRESSURE:
					this.channelPressureMessage = msg;
					break;
				case Cmd.PITCH_WHEEL:
					this.pitchWheelMessage = msg;
					break;
				default:
					break;
			}
		}
	}

	// Set moment.messages to all the current commands and controls
	// followed by any NoteOffs and/or NoteOns already in the moment
	update(moment)
	{
		function pushIfNotNull(messages, msg)
		{
			if(msg !== null)
			{
				messages.push(msg);
			}
		}

		let messages = moment.messages,
			noteOffs = [],
			noteOns = [];

		for(let msg of messages)
		{
			switch(msg.command())
			{
				case Cmd.NOTE_ON:
					noteOns.push(msg);
					break;
				case Cmd.NOTE_OFF:
					noteOffs.push(msg);
					break;
				default:
					break;
			}
		}

		messages = [];
		for(let msg of noteOffs)
		{
			messages.push(msg);
		}
		pushIfNotNull(messages, this.aftertouchMessage);
		pushIfNotNull(messages, this.programChangeMessage);
		pushIfNotNull(messages, this.channelPressureMessage);
		pushIfNotNull(messages, this.pitchWheelMessage);
		for(let msg of this.controlMessages)
		{
			messages.push(msg);
		}
		for(let msg of noteOns)
		{
			messages.push(msg);
		}

		moment.messages = messages;
	}
}

