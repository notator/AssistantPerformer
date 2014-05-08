
/********************************************************************
*
*  ACHTUNG: This file is just a stub.
*  The functions (and special performance options) need completing.
*
********************************************************************/

/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/PolyInput.js
*  The _AP.polyInput namespace which defines
*
*    // initialization
*    init(player, score.performerOptions)
*
*    //  returns an object contining the start and end positions of the player's current segment
*    currentSegmentBounds()
*
*    // message handler for input devices
*    handleMIDIInputEvent(msg)   
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.polyInput');

_AP.polyInput = (function()
{
    "use strict";

    // begin var
    var
    /***********************
    midiOutputDevice,

    tracks, // sequence.tracks. All the tracks, complete from the beginning to the end of the piece.
    performersOptions, // retrieved from the score

    // A flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    midiObjectMsPositionsInScore = [],
    midiObjectMsPositionsInScoreIndex = 0, // the current index in the above array

    // a flat, ordered array containing the msPositions of the live performer's MidiObjects.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    performersMsPositionsInScore = [],
    performersMsPositionsInScoreIndex = 0, // an index in the performersMsPositionsInScore array (updated when a NoteOn is received)

    performanceStartTime, // the time at which the performance starts
    // Not sure if pausing is relevant in live performances...
    // Maybe delete startTimeAdjustedForPauses and disable the pause button in live performances.
    startTimeAdjustedForPauses,
    ***********************/

    // This is where input MIDIEvents arrive, and where processing is going to be done.
    // Both RealTime and SysEx messages are ignored.
    // it is assumed that RealTime messages will not interrupt the messages being received.
    //
    // This function treats each received input key (NoteOn/NoteOff) in its own right.
    // Can work like a prepared piano. There may be options that decide that. Needs thinking about.
    handleMIDIInputEvent = function(msg)
    {   
        console.log("polyInput.handleMIDIInputEvent(msg) has not yet been written.");
    },

    currentSegmentBounds = function()
    {
        console.log("polyInput.currentSegmentBounds() has not yet been written.");
    },

    nextMoment = function()
    {
        console.log("polyInput.nextMoment() has not yet been written.");
    },

    // runtimeInit() is called from player.play() if options.livePerformance is true, and
    // options.performerOptions.inputDeviceType === 'polyInput'. 
    // Arguments:
    //      outputDevice: the midiOutputDevice.
    //      allTracks: all the tracks, complete from the beginning to the end of the piece.
    //      moMsPositionsInScore: a flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    //          The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    //      scorePerformerOptions: the polyInput options retrieved from the score.
    //      usePerformersNextMomentFunction: a callback function that sets the player to use the polyInput's nextMoment function
    //          which is defined in this namespace and uses variables local to this namespace.
    runtimeInit = function(outputDevice, allTracks, moMsPositionsInScore, scorePerformerOptions, usePerformersNextMomentFunction)
    {
        console.log("polyInput.runtimeInit() has not yet been written.");
    },

    publicAPI =
    {
        runtimeInit: runtimeInit,
        handleMIDIInputEvent: handleMIDIInputEvent,
    };
    // end var

    return publicAPI;

}());
