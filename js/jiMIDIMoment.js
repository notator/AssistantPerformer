/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMIDIMoment.js
 *  The JI_NAMESPACE.midiMoment namespace which defines a MIDIMoment object.
 *  MIDIMoments are used in Tracks.
 *
 *       MIDIMoment(msPosition) // constructs an empty MIDIMoment at msPosition
 *
 *       Public interface:
 *        midiMoment.timestamp; // the msPosition in the sequence
 *        midiMoment.messages = messages; // an array of midiMessages (can be empty)
 *        midiMoment.addMIDIMessage(MIDIMessage)
 *        midiMoment.mergeMIDIMoment(MIDIMoment); // appends another MIDIMoment,
 *                                              // having the same timestamp (=msPosition),
 *                                              // to the end of this MIDIMoment.  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.midiMoment');

JI_NAMESPACE.midiMoment = (function ()
{
    "use strict";

    var 
    // MIDIMoment constructor
    // This is an array of midiMessages, all of which have the same timestamp (=msPosition)
    MIDIMoment = function (msPosition)
    {
        var timestamp,
            messages = [],

        // Currently, MIDIMessages are only ever appended to
        // the end of the MIDIMoment, but that might change. 
        addMIDIMessage = function (midiMessage)
        {
            var errorText = "";
            if (midiMessage.timestamp !== undefined && midiMessage.timestamp >= 0)
            {
                if (midiMessage.timestamp === timestamp)
                {
                    messages.push(midiMessage);
                }
                else
                {
                    errorText = "attempt to add MIDIMessage with wrong timestamp to a MIDIMoment.";
                }
            }
            else
            {
                errorText = "undefined or negative timestamp.";
            }

            if (errorText.length > 0)
            {
                throw "Error: " + errorText + "timestamp: " + timestamp + ", midimessage:" + midiMessage.toString();
            }
        },

        // Adds the moment2.messages to the end of the current messages, and
        // sets restStart, chordStart and msPositionInScore where necessary.
        // Throws an exception if moment2.timestamp !== this.timestamp. 
        mergeMIDIMoment = function (moment2)
        {
            var i, moment2Messages, moment2MessagesLength;

            if (timestamp !== moment2.timestamp)
            {
                throw "Error: attempt to merge moments having different timestamps.";
            }

            if (moment2.messages[0].msPositionInScore !== undefined)
            {
                // moment2 is a restStart or chordStart
                this.messages[0].msPositionInScore = moment2.messages[0].msPositionInScore;

                if (moment2.restStart !== undefined)
                {
                    // don't copy the empty message
                    moment2.messages = [];
                    this.restStart = true;
                }
                else if (moment2.chordStart !== undefined)
                {
                    this.chordStart = true;
                }
                else
                {
                    throw "Error: moment2 must either have a restStart or a chordStart attribute.";
                }
            }
            moment2Messages = moment2.messages;
            moment2MessagesLength = moment2Messages.length;
            for (i = 0; i < moment2MessagesLength; ++i)
            {
                addMIDIMessage(moment2Messages[i]);
            }
        };

        if (!(this instanceof MIDIMoment))
        {
            return new MIDIMoment(msPosition);
        }

        timestamp = msPosition;

        this.timestamp = timestamp;
        this.messages = messages;
        this.addMIDIMessage = addMIDIMessage;
        this.mergeMIDIMoment = mergeMIDIMoment;

        return this;
    },

    publicAPI =
    {
        // creates an empty MIDIMoment
        MIDIMoment: MIDIMoment
    };
    // end var

    return publicAPI;

} ());
