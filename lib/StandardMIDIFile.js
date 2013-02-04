/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  StandardMIDIFile.js
 *  The MIDI_API.standardMIDIFile namespace which exposes the functions
 *
 *      // Convert a Sequence to a Standard MIDI File
 *      standardMidiFile = sequenceToSMF(sequence);
 *
 *      // Convert a Standard MIDI File to a Sequence
 *      // TODO: sequence = smfToSequence(standardMIDIFile);
 *
 *  Examples, showing how to load and save Standard MIDI files can be found in
 *  lib/examples.txt 
 */

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

MIDI_API.namespace('MIDI_API.standardMIDIFile');

MIDI_API.standardMIDIFile = (function ()
{
    "use strict";

    var
    // Returns the number of bytes used by the MIDI 'variable length value' corresponding 
    // to the argument value.
    _variableLengthValueLength = function (value)
    {
        var length;

        if (value < 0)
        {
            throw "Error: value may not be negative.";
        }
        else if (value < 128) // 7 bits, 8th bit is 2^7 == 128
        {
            length = 1;
        }
        else if (value < 16384) // 14 bits, 15th bit is 2^14 == 16384
        {
            length = 2;
        }
        else if (value < 2097152) // 21 bits, 22nd bit is 2^21 == 2097152
        {
            length = 3;
        }
        else if (value < 268435456) // 28 bits, 29th bit is 2^28 == 268435456
        {
            length = 4;
        }
        else
        {
            throw "Error: value out of range";
        }

        return length;
    },

    // Returns a Uint8Array of the correct length, containing the
    // argument value as a MIDI 'variable length value'.
    _getVariableLengthValue = function (value)
    {
        var 
        inBuffer = new ArrayBuffer(4),
        inDV = new DataView(inBuffer),
        inByte0, inByte1, inByte2, inByte3,
        outBuffer = new ArrayBuffer(4),
        outDV = new DataView(outBuffer),
        outByte,
        outLength = _variableLengthValueLength(value),
        returnValue;

        inDV.setUint32(0, value);
        inByte0 = inDV.getUint8(0);
        inByte1 = inDV.getUint8(1);
        inByte2 = inDV.getUint8(2);
        inByte3 = inDV.getUint8(3);

        outDV.setUint8(3, inByte3 & 0x7F); // 8th bit is not set
        if (outLength > 1)
        {
            outByte = (((inByte3 >> 7) + (inByte2 << 1)) & 0x7F) + 0x80;
            outDV.setUint8(2, outByte);
        }
        if (outLength > 2)
        {
            outByte = (((inByte2 >> 6) + (inByte1 << 2)) & 0x7F) + 0x80;
            outDV.setUint8(1, outByte);
        }
        if (outLength > 3)
        {
            outByte = (((inByte1 >> 5) + (inByte0 << 3)) & 0x7F) + 0x80;
            outDV.setUint8(0, outByte);
        }

        returnValue = new Uint8Array(outBuffer, 4 - outLength);

        return returnValue;
    },

    // Returns the sequence argument converted to a standard MIDI File
    // The returned object is actually a Blob. See https://developer.mozilla.org/en/docs/DOM/Blob.
    // The file can be downloaded by connecting it to a document link element, which the user can then click.
    // The link's href should be set as follows:
    //      a.href = window.URL.createObjectURL(standardMIDIFile);
    // It is otherwise the responsibility of the calling code to design and create the link element.
    // It could be a simple text link, or be something more elaborate using images etc. 
    // Arguments:        
    // sequence contains a Sequence.
    //      Sequence.tracks is an array of Track (tracks are parallel in time)
    //      Track.moments is an array of Moment (moments are sequential in the track)
    //      Moment.events is an array of Event (events in a moment have the same timestamp)
    //      Event.data is an array of byte, (the bytes in the data are in sequence in the file)
    //      Event.timestamp is the (floating point) time from the beginning of the Sequence.
    //          MIDI timestamps precede their event, and are relative to the previous event.
    //          This function stores time in milliseconds (packed into a small number of bytes,
    //          according to standard MIDI packing algorithm).
    //      The sequence's tracks currently do not include the events which are automatically
    //      written into the file at the end of each track. These events (which happen "synchronously")
    //      are AllControllersOff, AllSoundOff and EndOfTrack.
    // sequenceMsDuration is the total duration of the sequence in milliseconds (an integer),
    //      and determines the timing of the end-of-track events. When this is a recorded sequence,
    //      this value is simply the duration between the start and end markers.
    sequenceToSMF = function (sequence, sequenceMsDuration)
    {
        var
        midiArray,
        smf = null,
        earliestTimestamp,
        tracks = sequence.tracks;

        // Returns true if any of the tracks contain moments, otherwise false.
        // Used to prevent the creation of a 'save' button when there is nothing to save.
        function hasData(tracks)
        {
            var
            i, has = false,
            nTracks = tracks.length;

            for (i = 0; i < nTracks; ++i)
            {
                if (tracks[i].moments.length > 0)
                {
                    has = true;
                    break;
                }
            }
            return has;
        }

        // Returns the earliest moment timestamp in the sequence.
        // This should usually be 0.
        function getEarliestTimestamp(tracks)
        {
            var
            i,
            earliestTimestamp = Number.MAX_VALUE,
            firstMomentTimestamp,
            nTracks = tracks.length;

            for (i = 0; i < nTracks; ++i)
            {
                if (tracks[i].moments.length > 0)
                {
                    firstMomentTimestamp = tracks[i].moments[0].timestamp;
                    earliestTimestamp = earliestTimestamp < firstMomentTimestamp ? earliestTimestamp : firstMomentTimestamp;
                }
            }

            if (earliestTimestamp === Number.MAX_VALUE)
            {
                throw "Error: At least one track must contain a timed message!";
            }

            return earliestTimestamp;
        }

        // Returns a Uint8Array containing the complete standard MIDI file.
        function sequenceToUint8Array(earliestTimestamp, tracks, sequenceMsDuration)
        {
            var i, trackChunk, trackChunks = [], trackChunksLength = 0,
            nPerformingTracks,
            midiHeaderChunk,
            offset,
            midiFileArrayBuffer, midiFileArray,
            nTracks = tracks.length;

            // Returns a UintArray containing a track chunk (track header + data)
            function getTrackChunk(earliestTimestamp, trackMoments, sequenceMsDuration)
            {
                var
                trackData, trackHeader, trackChunk, trackEvents;

                // Returns a flat array of events for the track.
                function getTrackEvents(trackMoments)
                {
                    var
                    i, nMoments = trackMoments.length, moment,
                    j, nEvents,
                    trackEvents = [];

                    for (i = 0; i < nMoments; ++i)
                    {
                        moment = trackMoments[i];
                        nEvents = moment.events.length;
                        for (j = 0; j < nEvents; ++j)
                        {
                            trackEvents.push(moment.events[j]);
                        }
                    }

                    return trackEvents;
                }

                // Returns a Uint8Array containing the track's data bytes
                function getTrackData(startOfTrackTimeOffset, trackEvents, endOfTrackTimestamp)
                {
                    var i, nEvents = trackEvents.length, evt,
                    dataLength, buffer, trackData,
                    previousTimestamp = startOfTrackTimeOffset, timeOffset,
                    variableLengthTime, j, variableLengthTimeLength,
                    dv, offset = 0, controlChange;

                    // Returns the length of the track's data, in bytes.
                    // events contains the sequence of messages for a single track.
                    function getTrackDataLength(startOfTrackTimeOffset, trackEvents, endOfTrackTimestamp)
                    {
                        var
                        i, evt, timeOffset,
                        nEvents = trackEvents.length,
                        dataLength = 0,
                        previousTimestamp = startOfTrackTimeOffset;

                        for (i = 0; i < nEvents; ++i)
                        {
                            evt = trackEvents[i];
                            timeOffset = evt.timestamp - previousTimestamp;
                            previousTimestamp = evt.timestamp;

                            dataLength += _variableLengthValueLength(timeOffset);
                            dataLength += evt.data.length;
                        }

                        timeOffset = endOfTrackTimestamp - previousTimestamp;
                        dataLength += _variableLengthValueLength(timeOffset);
                        dataLength += 3; // all sound off ( Bx 78 00 )
                        dataLength += 4; // time + all controllers off ( 00 Bx 79 00 ) 
                        dataLength += 4; // time + end of track event  ( 00 FF 2F 00 )

                        return dataLength;
                    }

                    dataLength = getTrackDataLength(startOfTrackTimeOffset, trackEvents, endOfTrackTimestamp);
                    buffer = new ArrayBuffer(dataLength);
                    trackData = new Uint8Array(buffer);
                    dv = new DataView(buffer);

                    for (i = 0; i < nEvents; ++i)
                    {
                        evt = trackEvents[i];
                        timeOffset = evt.timestamp - previousTimestamp;
                        previousTimestamp = evt.timestamp;

                        variableLengthTime = _getVariableLengthValue(timeOffset);
                        variableLengthTimeLength = variableLengthTime.length;
                        for (j = 0; j < variableLengthTimeLength; ++j)
                        {
                            dv.setUint8(offset++, variableLengthTime[j]);
                        }

                        if (evt.data.length === 2)
                        {
                            dv.setUint8(offset++, evt.data[0]);
                            dv.setUint8(offset++, evt.data[1]);
                        }
                        else if (evt.data.length === 3)
                        {
                            dv.setUint8(offset++, evt.data[0]);
                            dv.setUint8(offset++, evt.data[1]);
                            dv.setUint8(offset++, evt.data[2]);
                        }
                        else
                        {
                            throw "Error: unexpected Event.data length.";
                        }
                    }

                    // end of track events ******************************
                    //
                    // If the allSoundOff and allControllersOff messages
                    // are not included, Windows Media Player will not play
                    // the last chord in the track. Probably a safety measure!
                    // Quicktime is also playing the last chord now! 

                    timeOffset = endOfTrackTimestamp - previousTimestamp;
                    variableLengthTime = _getVariableLengthValue(timeOffset);
                    variableLengthTimeLength = variableLengthTime.length;
                    for (j = 0; j < variableLengthTimeLength; ++j)
                    {
                        dv.setUint8(offset++, variableLengthTime[j]);
                    }

                    controlChange = 0xB0 + trackEvents[0].channel();

                    dv.setUint8(offset++, controlChange); // all sound off
                    dv.setUint8(offset++, 0x78); // all sound off
                    dv.setUint8(offset++, 0x00); // all sound off

                    dv.setUint8(offset++, 0x00); // all controllers off (time byte)
                    dv.setUint8(offset++, controlChange); // all controllers off
                    dv.setUint8(offset++, 0x79); // all controllers off
                    dv.setUint8(offset++, 0x00); // all controllers off

                    dv.setUint8(offset++, 0x00); // end of track event (time byte)
                    dv.setUint8(offset++, 0xFF); // end of track event
                    dv.setUint8(offset++, 0x2F); // end of track event
                    dv.setUint8(offset++, 0x00); // end of track event

                    return trackData;
                }

                // Returns a Uint8Array containing a track header
                function getTrackHeader(dataLength)
                {
                    var
                    buffer = new ArrayBuffer(8),
                    trackHeader = new Uint8Array(buffer),
                    dv = new DataView(buffer);

                    dv.setUint8(0, 0x4D); // 'M'
                    dv.setUint8(1, 0x54); // 'T'
                    dv.setUint8(2, 0x72); // 'r'
                    dv.setUint8(3, 0x6B); // 'k'
                    dv.setUint32(4, dataLength);

                    return trackHeader;
                }

                trackEvents = getTrackEvents(trackMoments);

                // earliestTimestamp - 200 and sequenceMsDuration + 300 
                // so that the start and end of playback are not quite so abrupt.
                trackData = getTrackData(earliestTimestamp - 200, trackEvents, sequenceMsDuration + 300);
                trackHeader = getTrackHeader(trackData.length);
                trackChunk = new Uint8Array(trackHeader.length + trackData.length);
                trackChunk.set(trackHeader, 0);
                trackChunk.set(trackData, trackHeader.length);

                return trackChunk;
            }

            // Returns a Uint8Array containing the MIDI header chunk
            function getMIDIHeaderChunk(nTracks)
            {
                var 
                buffer = new ArrayBuffer(14),
                midiHeaderChunk = new Uint8Array(buffer),
                dv = new DataView(buffer);

                dv.setUint8(0, 0x4D); // 'M'
                dv.setUint8(1, 0x54); // 'T'
                dv.setUint8(2, 0x68); // 'h'
                dv.setUint8(3, 0x64); // 'd'

                dv.setUint32(4, 0x6); // data length (big endian)

                dv.setUint16(8, 0x1); // MIDI File type 1, multiple tracks (big endain)
                dv.setUint16(10, nTracks); // number of tracks (big endain)

                dv.setUint8(12, 0xE7); // division -- time is measured in milliseconds
                dv.setUint8(13, 0x28); // division -- time is measured in milliseconds

                return midiHeaderChunk;
            }

            for (i = 0; i < nTracks; ++i)
            {
                if (tracks[i].moments.length > 0)
                {
                    trackChunk = getTrackChunk(earliestTimestamp, tracks[i].moments, sequenceMsDuration);
                    trackChunksLength += trackChunk.length;
                    trackChunks.push(trackChunk);
                }
            }

            nPerformingTracks = trackChunks.length;

            midiHeaderChunk = getMIDIHeaderChunk(nPerformingTracks);
            midiFileArrayBuffer = new ArrayBuffer(midiHeaderChunk.length + trackChunksLength);
            midiFileArray = new Uint8Array(midiFileArrayBuffer);

            midiFileArray.set(midiHeaderChunk, 0);
            offset = midiHeaderChunk.length;
            for (i = 0; i < nPerformingTracks; ++i)
            {
                midiFileArray.set(trackChunks[i], offset);
                offset += trackChunks[i].length;
                delete trackChunks[i];
            }

            return midiFileArray;
        }

        if (hasData(tracks))
        {
            earliestTimestamp = getEarliestTimestamp(tracks);

            midiArray = sequenceToUint8Array(earliestTimestamp, tracks, sequenceMsDuration);
            smf = new Blob([midiArray], { type: 'audio/midi' });
        }

        return smf;
    },

    publicAPI =
    {
        sequenceToSMF: sequenceToSMF //,
        //smfToSequence: smfToSequence
    };

    return publicAPI;

} ());

