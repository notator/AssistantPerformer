/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  midiLib/StandardMIDIFile.js
 *  The MIDILib.standardMIDIFile namespace which exposes the functions
 *
 *      // Convert a Sequence to a Standard MIDI File (actually a Blob).
 *      // The SMF can be made downloadable by connecting it to a document link element.
 *      // When the user clicks the link, the browser saves the file on the user's
 *      // computer. See https://developer.mozilla.org/en/docs/DOM/Blob.
 *      standardMIDIFile = sequenceToSMF(sequence);
 *
 *      // TODO (1st March 2013)
 *      // Convert a Standard MIDI File to a Sequence
 *      // sequence = smfToSequence(standardMIDIFile);
 *      // This function is currently not needed, but it would be interesting
 *      // to implement it, and use standard MIDI Files as the input to the
 *      // Assistant Performer. It should also be possible to create scores
 *      // automatically from SMFs, using software similar to my
 *      // Assistant Composer (which currently exists only in C#). See
 *      // http://james-ingram-act-two.de/moritz2/assistantComposer/assistantComposer.html
 */

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

MIDILib.namespace('MIDILib.standardMIDIFile');

MIDILib.standardMIDIFile = (function ()
{
    "use strict";

    var
    // Returns the number of bytes used by the MIDI 'variable length value' corresponding 
    // to the argument value.
    // The argument 'value' should never be negative.
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
    // Steps have been taken to ensure that value is never negative here.
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
    // This function stores the timings in milliseconds (packed into a small number of bytes,
    // according to the standard MIDI packing algorithm).
    // The returned object is actually a Blob. See https://developer.mozilla.org/en/docs/DOM/Blob.
    // The file can be downloaded by connecting it to a document link element, which the user can
    // then click.
    // The link's href should be set as follows:
    //      a.href = window.URL.createObjectURL(standardMIDIFile);
    // It is otherwise the responsibility of the calling code to design and create the link element.
    // It could be a simple text link, or be something more elaborate using images etc. 
    // Arguments:        
    // sequence contains a Sequence.
    //      Sequence.tracks is an array of Track (tracks are parallel in time) (see Sequence.js)
    //      Track.moments is an array of Moment (moments are sequential in the track) (see Track.js)
    //          Tracks do not include the messages which are automatically written into
    //          the file at the end of each track (after sequenceMsDuration). These messages, which
    //          all happen "synchronously", are AllControllersOff, AllSoundOff and EndOfTrack.
    //      Moment.messages is an array of Message (see Moment.js)
    //          All the messages in a moment are sent with no delay between them. The time
    //          at which they are sent is determined by the moment's timestamp attribute.
    //          When sequenceToSMF() is called, moment.timestamp is the (whole) number of
    //          milliseconds between the moment and the beginning of the sequence (=file).
    //      Message.data is a Uint8Array (an array of byte). (see Message.js)
    //          The proposed Web MIDI API calls a "Message" an "Event" but, for me, an "Event" is
    //          a temporal entity, and Messages have no temporal attribute. An "Event" is, for me,
    //          the temporal equivalent of an "Object", and I need the word elsewhere.          
    // sequenceMsDuration is the total duration of the sequence in (whole) milliseconds. It determines
    //      the timing of the end-of-track messages.
    sequenceToSMF = function (sequence, sequenceMsDuration)
    {
        var
        midiArray,
        smf = null,
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

        // Returns a Uint8Array containing the complete standard MIDI file.
        // Moment timestamps are currently relative to the start of the tracks, so the
        // earliest moment timestamp is 0.
        // Moment.msPositionInScore is always ignored.
        function sequenceToUint8Array(tracks, sequenceMsDuration)
        {
            var i, trackChunk, trackChunks = [], trackChunksLength = 0,
            nPerformingTracks,
            midiHeaderChunk,
            offset,
            midiFileArrayBuffer, midiFileArray,
            nTracks = tracks.length;

            // Returns a UintArray containing a track chunk (track header + data)
            function getTrackChunk(trackMoments, sequenceMsDuration)
            {
                var
                trackData, trackHeader, trackChunk, trackMessages;

                // The other midiLib functions should create tracks containing moments having unique timestamps in ascending order,
                // but I have (very seldom) experienced exceptions being thrown at the beginning of the function
                // _variableLengthValueLength(value) above, showing that this is not always the case.
                // Probably, the moment.timestamps sometimes get slightly out of order as a result of awkward thread switching.
                // This anomalous state should, however, not lead to the loss of an otherwise good recording, so I have added
                // this function to force a solution:
                // If a moment's timestamp is less than its predecessor's, moment.timestamp is set to the predecessor's timestamp.
                // Equal timestamps should not be produced by the other midiLib code, but this state does not actually lead to a broken,
                // unplayable Standard MIDI File. 
                function validateMomentTimestamps(trackMoments)
                {
                    var
                    i, nMoments = trackMoments.length, moment, previousMoment, diff;

                    if (nMoments > 1)
                    {
                        for (i = 1; i < nMoments; ++i)
                        {
                            moment = trackMoments[i];
                            previousMoment = trackMoments[i-1];
                            if (previousMoment.timestamp > moment.timestamp)
                            {
                                diff = Math.ceil(previousMoment.timestamp - moment.timestamp);
                                //console.log("moment.timestamp out of order (now corrected). Time difference re previous was: " + diff + "ms");
                                moment.timestamp = previousMoment.timestamp;
                            }
                        }
                    }
                }

                // Add a timestamp attribute to each message, setting it to the moment's timestamp.
                // An exception is thrown if a MIDI realTime message is found while looping through the messages.
                // The recorded Sequence should never contain MIDI realTime messages.
                function createMessageTimestamps(trackMoments)
                {
                    var
                    isRealTimeStatus = MIDILib.constants.isRealTimeStatus,
                    i, nMoments = trackMoments.length, moment,
                    j, nMessages, timestamp, previousTimestamp = -1, message;

                    for (i = 0; i < nMoments; ++i)
                    {
                        moment = trackMoments[i];
                        timestamp = moment.timestamp;
                        nMessages = moment.messages.length;
                        for (j = 0; j < nMessages; ++j)
                        {
                            message = moment.messages[j];
                            if(isRealTimeStatus(message.data[0]))
                            {
                                throw "Error: MIDI realTime messages should never be recorded in the Sequence.";
                            }
                            message.timestamp = timestamp;
                        }
                        previousTimestamp = timestamp;
                    }
                }

                // Delete each message's timestamp.
                function deleteMessageTimestamps(trackMoments)
                {
                    var
                    i, nMoments = trackMoments.length, moment,
                    j, nMessages;

                    for (i = 0; i < nMoments; ++i)
                    {
                        moment = trackMoments[i];
                        nMessages = moment.messages.length;
                        for (j = 0; j < nMessages; ++j)
                        {
                            delete moment.messages[j].timestamp;
                        }
                    }
                }

                // Returns a flat array of (timestamped) messages for the track.
                function getTrackMessages(trackMoments)
                {
                    var
                    i, nMoments = trackMoments.length, moment,
                    j, nMessages,
                    trackMessages = [];

                    for (i = 0; i < nMoments; ++i)
                    {
                        moment = trackMoments[i];
                        nMessages = moment.messages.length;
                        for (j = 0; j < nMessages; ++j)
                        {
                            trackMessages.push(moment.messages[j]);
                        }
                    }

                    return trackMessages;
                }

                // Returns a Uint8Array containing the track's data bytes
                function getTrackData(startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp)
                {
                    var i, nMessages = trackMessages.length, msg,
                    dataLength, buffer, trackData,
                    previousTimestamp = startOfTrackTimeOffset, timeOffset,
                    variableLengthTime, j, variableLengthTimeLength,
                    dv, offset = 0, controlChange;

                    // Returns the length of the track's data, in bytes.
                    // messages contains the sequence of messages for a single track.
                    function getTrackDataLength(startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp)
                    {
                        var
                        i, msg, timeOffset,
                        nMessages = trackMessages.length,
                        dataLength = 0,
                        previousTimestamp = startOfTrackTimeOffset;

                        for (i = 0; i < nMessages; ++i)
                        {
                            msg = trackMessages[i];
                            timeOffset = msg.timestamp - previousTimestamp;
                            previousTimestamp = msg.timestamp;

                            dataLength += _variableLengthValueLength(timeOffset);
                            dataLength += msg.data.length;
                        }

                        timeOffset = endOfTrackTimestamp - previousTimestamp;
                        dataLength += _variableLengthValueLength(timeOffset);
                        dataLength += 3; // all sound off ( Bx 78 00 )
                        dataLength += 4; // time + all controllers off ( 00 Bx 79 00 ) 
                        dataLength += 4; // time + end of track message  ( 00 FF 2F 00 )

                        return dataLength;
                    }

                    dataLength = getTrackDataLength(startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp);
                    buffer = new ArrayBuffer(dataLength);
                    trackData = new Uint8Array(buffer);
                    dv = new DataView(buffer);

                    for (i = 0; i < nMessages; ++i)
                    {
                        msg = trackMessages[i];
                        if(msg.timestamp > previousTimestamp)
                        {
                            timeOffset = msg.timestamp - previousTimestamp;
                            previousTimestamp = msg.timestamp;
                        }
                        else
                        {
                            timeOffset = 0;
                        }

                        variableLengthTime = _getVariableLengthValue(timeOffset);
                        variableLengthTimeLength = variableLengthTime.length;
                        for (j = 0; j < variableLengthTimeLength; ++j)
                        {
                            dv.setUint8(offset++, variableLengthTime[j]);
                        }

                        if (msg.data.length === 2)
                        {
                            dv.setUint8(offset++, msg.data[0]);
                            dv.setUint8(offset++, msg.data[1]);
                        }
                        else if (msg.data.length === 3)
                        {
                            dv.setUint8(offset++, msg.data[0]);
                            dv.setUint8(offset++, msg.data[1]);
                            dv.setUint8(offset++, msg.data[2]);
                        }
                        else
                        {
                            throw "Error: unexpected Message.data length.";
                        }
                    }

                    // end of track messages ******************************
                    //
                    // If the allSoundOff and allControllersOff messages
                    // are not included, Windows Media Player will not play
                    // the last chord in the track. Probably a safety measure!
                    // Quicktime is also playing the last chord now! 

                    if(endOfTrackTimestamp > previousTimestamp)
                    {
                        timeOffset = endOfTrackTimestamp - previousTimestamp;
                    }
                    else
                    {
                        timeOffset = 0;
                    }

                    variableLengthTime = _getVariableLengthValue(timeOffset);
                    variableLengthTimeLength = variableLengthTime.length;
                    for (j = 0; j < variableLengthTimeLength; ++j)
                    {
                        dv.setUint8(offset++, variableLengthTime[j]);
                    }

                    controlChange = 0xB0 + trackMessages[0].channel();

                    dv.setUint8(offset++, controlChange); // all sound off
                    dv.setUint8(offset++, 0x78); // all sound off
                    dv.setUint8(offset++, 0x00); // all sound off

                    dv.setUint8(offset++, 0x00); // all controllers off (time byte)
                    dv.setUint8(offset++, controlChange); // all controllers off
                    dv.setUint8(offset++, 0x79); // all controllers off
                    dv.setUint8(offset++, 0x00); // all controllers off

                    dv.setUint8(offset++, 0x00); // end of track message (time byte)
                    dv.setUint8(offset++, 0xFF); // end of track message
                    dv.setUint8(offset++, 0x2F); // end of track message
                    dv.setUint8(offset++, 0x00); // end of track message

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

                // In the unlikely event that a moment.timestamp is less than that of its predecessor,
                // it is set to its predecessor's value.
                validateMomentTimestamps(trackMoments);

                createMessageTimestamps(trackMoments);

                trackMessages = getTrackMessages(trackMoments);

                // Start the track 200 milliseconds before the first message in any track,
                // and end it 300 milliseconds after the end of the sequence 
                // so that the start and end of playback are not quite so abrupt.
                trackData = getTrackData(-200, trackMessages, sequenceMsDuration + 300);
                trackHeader = getTrackHeader(trackData.length);
                trackChunk = new Uint8Array(trackHeader.length + trackData.length);
                trackChunk.set(trackHeader, 0);
                trackChunk.set(trackData, trackHeader.length);

                deleteMessageTimestamps(trackMoments);

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
                    trackChunk = getTrackChunk(tracks[i].moments, sequenceMsDuration);
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
            midiArray = sequenceToUint8Array(tracks, sequenceMsDuration);
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

