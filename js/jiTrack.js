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
 *  A Track has the following public interface:
 *       addMIDIMessage(midiMessage);
 *       addMIDIMoment(midiMoment) // see JI_NAMESPACE.midiMoment
 *       midiMoments // an array of midiMoments
 *       fromIndex // used while performing
 *       currentIndex // used while performing
 *       toIndex // used while performing
 *  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.track');

JI_NAMESPACE.track = (function ()
{
    "use strict";

    var 
    jiMIDIMoment = JI_NAMESPACE.midiMoment,

    // An empty track is created. It contains an empty midiMoments array.
    Track = function ()
    {
        var midiMoments = [],
            fromIndex,
            currentIndex,
            toIndex,
            currentLastTimestamp = -1,

        // Currently, midiMoments can only be appended to
        // the end of the track, but that might change. 
        addMIDIMoment = function (midiMoment)
        {
            var lastMoment;

            if (midiMoment.timestamp > currentLastTimestamp)
            {
                currentLastTimestamp = midiMoment.timestamp;
                midiMoments.push(midiMoment);
            }
            else if (midiMoment.timestamp === currentLastTimestamp)
            {
                // Push the new midiMessages on to the end of the last midiMoment.  
                // currentLastTimestamp does not change.
                lastMoment = midiMoments[midiMoments.length - 1];
                lastMoment.addMIDIMoment(midiMoment);
                if (midiMoment.restStart !== undefined)
                {
                    if (midiMoment.chordStart !== undefined)
                    {
                        delete midiMoment.chordStart;
                    }
                    lastMoment.restStart = true;
                }
                else if (midiMoment.chordStart !== undefined)
                {
                    if (midiMoment.restStart !== undefined)
                    {
                        delete midiMoment.restStart;
                    }
                    lastMoment.chordStart = true;
                }
            }
            else
            {
                throw "Error: currently, midiMoments can only be appended to the ends of tracks.";
            }
        };

        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.addMIDIMoment = addMIDIMoment;
        this.midiMoments = midiMoments;
        this.fromIndex = fromIndex;
        this.currentIndex = currentIndex;
        this.toIndex = toIndex;
    },

    publicAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    return publicAPI;

} ());
