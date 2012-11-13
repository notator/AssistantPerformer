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
    // An empty track is created. It contains an empty midiMoments array.
    Track = function ()
    {
        var midiMoments = [],
            fromIndex,
            currentIndex,
            toIndex,
            currentLastTimestamp = -1,

        // A midiMoment can only be appended to the end of the track. 
        addMIDIMoment = function (midiMoment)
        {
            var lastMoment, timestamp = midiMoment.timestamp;

            if (timestamp > currentLastTimestamp)
            {
                currentLastTimestamp = timestamp;
                midiMoments.push(midiMoment); // can be a rest, containing one 'empty midiMessage'
            }
            else if (timestamp === currentLastTimestamp)
            {
                lastMoment = midiMoments[midiMoments.length - 1];

                if (midiMoment.restStart !== undefined)
                {
                    lastMoment.restStart = true;
                    // dont push the rest's 'empty midiMessage'
                }
                else if (midiMoment.chordStart !== undefined)
                {
                    lastMoment.chordStart = true;
                    // Push the new midiMessages on to the end of the last midiMoment in the same track.  
                    // currentLastTimestamp does not change.
                    lastMoment.addMIDIMoment(midiMoment);
                }
            }
            else
            {
                throw "Error: A midiMoment can only be appended to the end of a track.";
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
