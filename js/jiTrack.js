/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiTrack.js
 *  The JI_NAMESPACE.sequence namespace which defines the
 *    Track() empty sequence constructor.
 *  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.track');

JI_NAMESPACE.track = (function ()
{
    "use strict";

    var 
    // An empty track is created. It contains an empty midiMoments array.
    Track = function ()
    {
        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.midiMoments = [];
        this.fromIndex = -1;
        this.currentIndex = -1;
        this.toIndex = -1;
        this.currentLastTimestamp = -1;

        // defined in prototype:
        //     addMIDIMoment(midiMoment, sequencePositionInScore)
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    Track.prototype = (function ()
    {
        var
        // A midiMoment can only be appended to the end of the track.
        // The midiMoment's timestamp is currently relative to the piece,
        // but is changed here to be relative to its subsequence 
        addMIDIMoment = function (midiMoment, subsequenceMsPositionInScore)
        {
            var 
            midiMoments = this.midiMoments,
            timestamp, oldMoment;

            function subtractTime(midiMoment, subsequenceMsPositionInScore)
            {
                var i, nMessages = midiMoment.messages.length;

                midiMoment.timestamp -= subsequenceMsPositionInScore;
                for (i = 0; i < nMessages; ++i)
                {
                    midiMoment.messages[i].timestamp -= subsequenceMsPositionInScore;
                }
            }

            subtractTime(midiMoment, subsequenceMsPositionInScore);
            timestamp = midiMoment.timestamp;

            if (timestamp > this.currentLastTimestamp)
            {
                this.currentLastTimestamp = timestamp;
                midiMoments.push(midiMoment); // can be a rest, containing one 'empty midiMessage'
            }
            else if (timestamp === this.currentLastTimestamp)
            {
                oldMoment = midiMoments[midiMoments.length - 1];
                oldMoment.mergeMIDIMoment(midiMoment);
            }
            else
            {
                throw "Error: A midiMoment can only be appended to the end of a track.";
            }
        },

        prototypeAPI =
        {
            addMIDIMoment: addMIDIMoment
        };

        return prototypeAPI;

    } ());

    return publicTrackAPI;

} ());
