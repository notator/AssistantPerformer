/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  lib/Constants.js
 *  The MIDILib.constants namespace which defines read only constants in the following categories
 *      COMMAND
 *      RUNNING_STATUS
 *      CONTROL
 *      SYSTEM_EXCLUSIVE
 *      OTHER // non-MIDI constants (currently just UNDEFINED_TIMESTAMP)
 */

/*jslint bitwise: false, nomen: false, plusplus: false, white: true */

MIDILib.namespace('MIDILib.constants');

MIDILib.constants = (function ()
{
    "use strict";
    var 
    COMMAND = {},
    RUNNING_STATUS = {},
    CONTROL = {},
    SYSTEM_EXCLUSIVE = {},
    OTHER = {}, 
    API =
    {
        COMMAND: COMMAND,
        RUNNING_STATUS: RUNNING_STATUS,
        CONTROL: CONTROL,
        SYSTEM_EXCLUSIVE: SYSTEM_EXCLUSIVE,
        OTHER: OTHER
    };

    Object.defineProperty(COMMAND, "NOTE_OFF", { value: 0x80, writable: false });
    Object.defineProperty(COMMAND, "NOTE_ON", { value: 0x90, writable: false });
    Object.defineProperty(COMMAND, "POLY_AFTERTOUCH", { value: 0xA0, writable: false });
    Object.defineProperty(COMMAND, "CONTROL_CHANGE", { value: 0xB0, writable: false });
    Object.defineProperty(COMMAND, "PROGRAM_CHANGE", { value: 0xC0, writable: false });
    Object.defineProperty(COMMAND, "CHANNEL_AFTERTOUCH", { value: 0xD0, writable: false });
    Object.defineProperty(COMMAND, "PITCH_WHEEL", { value: 0xE0, writable: false }); // use to14Bit() to calculate the data1Arg and data2Arg constructor arguments

    // RUNNING_STATUS
    // Am I right in thinking that these are the RUNNING_STATUS constants?
    // As far as I can see, they are only needed when an application sends a stream of Events.
    // They are not stored in files. 0xF4, 0xF5, and 0xFD are missing. Do they do anything?
    //
    // 0xF0 is SYSTEM_EXCLUSIVE.START (used in Standard MIDI Files)
    Object.defineProperty(RUNNING_STATUS, "MTC_QUARTER_FRAME", { value: 0xF1, writable: false });
    Object.defineProperty(RUNNING_STATUS, "SONG_POSITION_POINTER", { value: 0xF2, writable: false });
    Object.defineProperty(RUNNING_STATUS, "SONG_SELECT", { value: 0xF3, writable: false });
    // ? : 0xF4
    // ? : 0xF5
    Object.defineProperty(RUNNING_STATUS, "TUNE_REQUEST", { value: 0xF6, writable: false });
    // 0xF7 is SYSTEM_EXCLUSIVE.END (used in Standard MIDI Files) 
    Object.defineProperty(RUNNING_STATUS, "MIDI_CLOCK", { value: 0xF8, writable: false });
    Object.defineProperty(RUNNING_STATUS, "MIDI_TICK", { value: 0xF9, writable: false });
    Object.defineProperty(RUNNING_STATUS, "MIDI_START", { value: 0xFA, writable: false });
    Object.defineProperty(RUNNING_STATUS, "MIDI_CONTINUE", { value: 0xFB, writable: false });
    Object.defineProperty(RUNNING_STATUS, "MIDI_STOP", { value: 0xFC, writable: false });
    // ? : 0xFD
    Object.defineProperty(RUNNING_STATUS, "ACTIVE_SENSE", { value: 0xFE, writable: false });
    Object.defineProperty(RUNNING_STATUS, "RESET", { value: 0xFF, writable: false });

    // CONTROL
    // These are all I use for the moment. This list needs to be completed.
    Object.defineProperty(CONTROL, "MODWHEEL", { value: 1, writable: false });
    Object.defineProperty(CONTROL, "DATA_ENTRY_COARSE", { value: 6, writable: false });
    Object.defineProperty(CONTROL, "PAN", { value: 10, writable: false });
    Object.defineProperty(CONTROL, "EXPRESSION", { value: 11, writable: false });
    Object.defineProperty(CONTROL, "REGISTERED_PARAMETER_FINE", { value: 100, writable: false });
    Object.defineProperty(CONTROL, "REGISTERED_PARAMETER_COARSE", { value: 101, writable: false });

    // SYSTEM_EXCLUSIVE
    Object.defineProperty(SYSTEM_EXCLUSIVE, "START", { value: 0xF0, writable: false });
    Object.defineProperty(SYSTEM_EXCLUSIVE, "END", { value: 0xF7, writable: false });

    // OTHER
    Object.defineProperty(OTHER, "UNDEFINED_TIMESTAMP", { value: -1, writable: false });

    return API;

} ());

    
