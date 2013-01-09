/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMain.js
 *  1. Ensures that the relevant window interfaces are set correctly.
 *  2. Retrieves the midiAccess object, currently using the Jazz plugin v1.2
 *     http://jazz-soft.net/
 *  3. Calls the following namespace initialisation functions:
 *      JI_NAMESPACE.jiAPControls.init(midiAccess);
 *      JI_NAMESPACE.assistant.init(MESSAGE_CREATION_DATA);
 *      JI_NAMESPACE.sequence.init(MESSAGE_CREATION_DATA);
 *      JI_NAMESPACE.midiChord.init(MESSAGE_CREATION_DATA);
 *
 *  MESSAGE_CREATION_DATA is a constant object containing a function and constant
 *  data which enables MIDIMessage objects to be created inside the namespaces.
 */

window.addEventListener("load", function ()
{
    "use strict";

    var
    midiAccess, 
    jiAPControls = JI_NAMESPACE.apControls,
    jiAssistant = JI_NAMESPACE.assistant,
    jiSequence = JI_NAMESPACE.sequence,
    jiMIDIChord = JI_NAMESPACE.midiChord,

    // Ensure that the relevant window interfaces are set correctly.
    // Currently this just affects window.performance, window.performance.now and window.URL
    setWindow = function ()
    {
        window.performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance || {};
        if (!window.performance.now)
        {
            window.performance.now = window.performance.webkitNow;
        }

        window.URL = window.URL || window.webkitURL;
    },

    midiMessageToString = function (msg)
    {
        var cmdString = "ERROR: UNKNOWN COMMAND";
        switch (msg.command)
        {
            case 0x80:
                cmdString = "NOTE OFF";
                break;
            case 0x90:
                cmdString = "NOTE ON";
                break;
            case 0xA0:
                cmdString = "AFTERTOUCH"; // = "POLY PRESSURE"
                break;
            case 0xB0:
                cmdString = "CONTROL CHANGE";
                break;
            case 0xC0:
                cmdString = "PROGRAM CHANGE";
                break;
            case 0xD0:
                cmdString = "CHANNEL PRESSURE";
                break;
            case 0xE0:
                cmdString = "PITCH BEND";
                break;
            case 0xF0:
                cmdString = "SYSTEM EXCLUSIVE";
                break;
        }
        return 'command:' + cmdString + ' channel:' + msg.channel + ' data1:' + msg.data1 + ' data2:' + msg.data2 + ' timestamp:' + msg.timestamp;
    },

    // The following MIDI message constructor has been extracted from JazzMIDIBridge.js
    // in abudaan's GitHub project at https://github.com/abudaan/JazzMIDIBridge.
    // It is used to create MIDI message objects throughout the rest of the Assistant Performer.
    createMIDIMessage = function (command, data1, data2, channel, timestamp)
    {
        var message = {
            command: command,
            status: parseInt(command) + (parseInt(channel) || 0),
            channel: channel || 0,
            data1: data1,
            data2: data2,
            timestamp: timestamp || 0
        };

        message.toString = function ()
        {
            return midiMessageToString(message);
        };

        return message;
    },

    // Constant object containing a function and data constants for creating MIDI messages
    MESSAGE_CREATION_DATA =
    {
        // MIDI message object constructor
        createMIDIMessage: createMIDIMessage,
        // MIDI commands
        NOTE_OFF: 0x80,
        NOTE_ON: 0x90,
        AFTERTOUCH: 0xA0,
        CONTROL_CHANGE: 0xB0,
        PROGRAM_CHANGE: 0xC0,
        CHANNEL_PRESSURE: 0xD0,
        PITCH_BEND: 0xE0,
        SYSTEM_EXCLUSIVE: 0xF0,
        // MIDI controls
        PAN_CONTROL: 10,
        MODWHEEL_CONTROL: 1,
        EXPRESSION_CONTROL: 11
    },

    // Just sets midiAccess (to the midiAccess argument)
    JMBInitFunction = function (MIDIAccess)
    {
        midiAccess = MIDIAccess;
    };

    setWindow();

    // When the Web MIDI API is implemented:
    // 1. delete the JMBInitFunction (above).
    // 2. replace the following line by the corresponding code for getting midiAccess.
    // 3. uninstall the Jazz plugin.
    JMB.init(JMBInitFunction); // now just sets midiAccess

    jiAPControls.init(midiAccess); // sets the contents of the device selector menus
    jiAssistant.init(MESSAGE_CREATION_DATA);
    jiSequence.init(MESSAGE_CREATION_DATA);
    jiMIDIChord.init(MESSAGE_CREATION_DATA);
}, false);


