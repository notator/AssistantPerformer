/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Constants.js
 *  The _AP.constants namespace which defines read-only MIDI constants
 *  in the following categories:
 *      COMMAND
 *      REAL_TIME
 *      CONTROL
 *      SYSTEM_EXCLUSIVE
 */

/*jslint bitwise: false, nomen: false, plusplus: false, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.constants');

_AP.constants = (function ()
{
    "use strict";
    var 
    COMMAND = {},
    REAL_TIME = {},
    CONTROL = {},
    SYSTEM_EXCLUSIVE = {},
    INPUT_ERROR_COLOR = "#FFDCDC", // the colour to which an input's background is set when there is an error.

    // True if constant is one of the REAL_TIME status bytes, otherwise false
    isRealTimeStatus = function(constant)
    {
        var result = false;

        if ((constant === REAL_TIME.MTC_QUARTER_FRAME)
        || (constant === REAL_TIME.SONG_POSITION_POINTER)
        || (constant === REAL_TIME.SONG_SELECT)
        || (constant === REAL_TIME.TUNE_REQUEST)
        || (constant === REAL_TIME.MIDI_CLOCK)
        || (constant === REAL_TIME.MIDI_TICK)
        || (constant === REAL_TIME.MIDI_START)
        || (constant === REAL_TIME.MIDI_CONTINUE)
        || (constant === REAL_TIME.MIDI_STOP)
        || (constant === REAL_TIME.ACTIVE_SENSE)
        || (constant === REAL_TIME.RESET))
        {
            result = true;
        }
        return result;
    },

    API =
    {
        COMMAND: COMMAND,
        REAL_TIME: REAL_TIME,
        CONTROL: CONTROL,
        SYSTEM_EXCLUSIVE: SYSTEM_EXCLUSIVE,
        isRealTimeStatus: isRealTimeStatus,
        INPUT_ERROR_COLOR: INPUT_ERROR_COLOR
    };

    Object.defineProperty(COMMAND, "NOTE_OFF", { value: 0x80, writable: false });
    Object.defineProperty(COMMAND, "NOTE_ON", { value: 0x90, writable: false });
    Object.defineProperty(COMMAND, "AFTERTOUCH", { value: 0xA0, writable: false });
    Object.defineProperty(COMMAND, "CONTROL_CHANGE", { value: 0xB0, writable: false });
    Object.defineProperty(COMMAND, "PROGRAM_CHANGE", { value: 0xC0, writable: false });
    Object.defineProperty(COMMAND, "CHANNEL_PRESSURE", { value: 0xD0, writable: false });
    Object.defineProperty(COMMAND, "PITCH_WHEEL", { value: 0xE0, writable: false });

    // REAL_TIME
    // These constants can be received or sent live during performances.
    // They are not stored in files.
    // The MIDI standard does not define 0xF4, 0xF5 or 0xFD.
    //
    // 0xF0 is SYSTEM_EXCLUSIVE.START (used in Standard MIDI Files)
    Object.defineProperty(REAL_TIME, "MTC_QUARTER_FRAME", { value: 0xF1, writable: false });
    Object.defineProperty(REAL_TIME, "SONG_POSITION_POINTER", { value: 0xF2, writable: false });
    Object.defineProperty(REAL_TIME, "SONG_SELECT", { value: 0xF3, writable: false });
    // 0xF4 is not defined by the MIDI standard
    // 0xF5 is not defined by the MIDI standard
    Object.defineProperty(REAL_TIME, "TUNE_REQUEST", { value: 0xF6, writable: false });
    // 0xF7 is SYSTEM_EXCLUSIVE.END (used in Standard MIDI Files) 
    Object.defineProperty(REAL_TIME, "MIDI_CLOCK", { value: 0xF8, writable: false });
    Object.defineProperty(REAL_TIME, "MIDI_TICK", { value: 0xF9, writable: false });
    Object.defineProperty(REAL_TIME, "MIDI_START", { value: 0xFA, writable: false });
    Object.defineProperty(REAL_TIME, "MIDI_CONTINUE", { value: 0xFB, writable: false });
    Object.defineProperty(REAL_TIME, "MIDI_STOP", { value: 0xFC, writable: false });
    // 0xFD is not defined by the MIDI standard
    Object.defineProperty(REAL_TIME, "ACTIVE_SENSE", { value: 0xFE, writable: false });
    Object.defineProperty(REAL_TIME, "RESET", { value: 0xFF, writable: false });

    // CONTROL
    // These are all I use for the moment (Feb. 2013).
    // This list could be easily be extended/completed.
	// Note that I am currently only using the "coarse" versions of these controls
    Object.defineProperty(CONTROL, "MODWHEEL", { value: 1, writable: false });
    Object.defineProperty(CONTROL, "DATA_ENTRY_COARSE", { value: 6, writable: false });
    Object.defineProperty(CONTROL, "VOLUME", { value: 7, writable: false });
    Object.defineProperty(CONTROL, "PAN", { value: 10, writable: false });
    Object.defineProperty(CONTROL, "EXPRESSION", { value: 11, writable: false });
    Object.defineProperty(CONTROL, "TIMBRE", { value: 71, writable: false });
    Object.defineProperty(CONTROL, "BRIGHTNESS", { value: 74, writable: false });
    Object.defineProperty(CONTROL, "EFFECTS", { value: 91, writable: false });
    Object.defineProperty(CONTROL, "TREMOLO", { value: 92, writable: false });
    Object.defineProperty(CONTROL, "CHORUS", { value: 93, writable: false });
    Object.defineProperty(CONTROL, "CELESTE", { value: 94, writable: false });
    Object.defineProperty(CONTROL, "PHASER", { value: 95, writable: false });
    Object.defineProperty(CONTROL, "REGISTERED_PARAMETER_FINE", { value: 100, writable: false });
    Object.defineProperty(CONTROL, "REGISTERED_PARAMETER_COARSE", { value: 101, writable: false });
    Object.defineProperty(CONTROL, "ALL_SOUND_OFF", { value: 120, writable: false });
    Object.defineProperty(CONTROL, "ALL_CONTROLLERS_OFF", { value: 121, writable: false });
    Object.defineProperty(CONTROL, "ALL_NOTES_OFF", { value: 123, writable: false });

    // SYSTEM_EXCLUSIVE
    Object.defineProperty(SYSTEM_EXCLUSIVE, "START", { value: 0xF0, writable: false });
    Object.defineProperty(SYSTEM_EXCLUSIVE, "END", { value: 0xF7, writable: false });

    return API;

} ());

    
