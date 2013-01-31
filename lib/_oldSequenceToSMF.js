/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  SequenceToSMF.js
 *  The MIDI_API.standardMIDIFile namespace which exposes two public functions
 *
 *    // Create a button which, when clicked, downloads a standard MIDI file recording
 *    // of the performance which has just ended. (See further comment on the function itself)
 *    createSaveMIDIFileButton(scoreName, midiTracksData, endMarkerTimestamp) 
 *
 *    // delete the 'save' button created by createSaveMIDIFileButton()
 *    deleteSaveMIDIFileButton() 
 */

MIDI_API.namespace('MIDI_API.standardMIDIFile');

MIDI_API.standardMIDIFile = (function (document, window)
{
    "use strict";

    var 
    // deletes the 'save' button created by createSaveMIDIFileButton() 
    deleteSaveMIDIFileButton = function ()
    {
        var 
        downloadLinkDiv,
        downloadLink = document.getElementById("downloadLink");

        if (downloadLink)
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv");
            downloadLinkDiv.innerHTML = '';

            // Need a small delay for the revokeObjectURL to work properly.
            setTimeout(function ()
            {
                window.URL.revokeObjectURL(downloadLink.href); // window.URL is set in jiMain.js
            }, 1500);
        }
    },

    getEarliestTimestamp = function (nTracks, midiTracksData)
    {
        var 
        i, earliestTimestamp = Number.MAX_VALUE;

        for (i = 0; i < nTracks; ++i)
        {
            if (midiTracksData[i].length > 0)
            {
                earliestTimestamp = earliestTimestamp < midiTracksData[i][0].timestamp ? earliestTimestamp : midiTracksData[i][0].timestamp;
            }
        }

        if (earliestTimestamp === Number.MAX_VALUE)
        {
            throw "Error: At least one track must contain a timed message!";
        }

        return earliestTimestamp;
    },

    // Returns true if the MIDI command only uses status and data1 fields, otherwise false
    isTwoByteCommand = function (command)
    {
        var returnValue = false,
        PROGRAM_CHANGE = 0xC0,
        CHANNEL_PRESSURE = 0xD0;

        if (command === PROGRAM_CHANGE || command === CHANNEL_PRESSURE)
        {
            returnValue = true;
        }

        return returnValue;
    },

    // Returns the number of bytes used by the MIDI 'variable length value' corresponding 
    // to the argument value.
    variableLengthValueLength = function (value)
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
    getVariableLengthValue = function (value)
    {
        var 
        inBuffer = new ArrayBuffer(4),
        inDV = new DataView(inBuffer),
        inByte0, inByte1, inByte2, inByte3,
        outBuffer = new ArrayBuffer(4),
        outDV = new DataView(outBuffer),
        outByte,
        outLength = variableLengthValueLength(value),
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

    // Returns the length of the track's data, in bytes.
    // events contains the sequence of messages for a single track.
    getTrackDataLength = function (startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp)
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

            dataLength += variableLengthValueLength(timeOffset);
            if (isTwoByteCommand(msg.command))
            {
                dataLength += 2;
            }
            else
            {
                dataLength += 3;
            }
        }

        timeOffset = endOfTrackTimestamp - previousTimestamp;
        dataLength += variableLengthValueLength(timeOffset);
        dataLength += 3; // all sound off ( Bx 78 00 )
        dataLength += 4; // time + all controllers off ( 00 Bx 79 00 ) 
        dataLength += 4; // time + end of track event  ( 00 FF 2F 00 )

        return dataLength;
    },

    // Returns a Uint8Array containing the track's data bytes
    getTrackData = function (startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp)
    {
        var i, nMessages = trackMessages.length, msg,
        dataLength = getTrackDataLength(startOfTrackTimeOffset, trackMessages, endOfTrackTimestamp),
        buffer = new ArrayBuffer(dataLength),
        trackData = new Uint8Array(buffer),
        previousTimestamp = startOfTrackTimeOffset, timeOffset,
        variableLengthTime, j, variableLengthTimeLength,
        dv = new DataView(buffer), offset = 0, controlChange;

        for (i = 0; i < nMessages; ++i)
        {
            // The msg belongs to the sequence.
            // Its timestamp is relative to the start of the score, so don't change it!
            // If msg.timestamp is corrupted, repeat performances will go wrong.
            msg = trackMessages[i];
            timeOffset = msg.timestamp - previousTimestamp;
            previousTimestamp = msg.timestamp;

            variableLengthTime = getVariableLengthValue(timeOffset);
            variableLengthTimeLength = variableLengthTime.length;
            for (j = 0; j < variableLengthTimeLength; ++j)
            {
                dv.setUint8(offset++, variableLengthTime[j]);
            }

            if (isTwoByteCommand(msg.command))
            {
                dv.setUint8(offset++, msg.status);
                dv.setUint8(offset++, msg.data1);
            }
            else
            {
                dv.setUint8(offset++, msg.status);
                dv.setUint8(offset++, msg.data1);
                dv.setUint8(offset++, msg.data2);
            }
        }

        // end of track events ******************************
        //
        // If the allSoundOff and allControllersOff messages
        // are not included, Windows Media Player will not play
        // the last chord in the track. Probably a safety measure!
        // Quicktime is also playing the last chord now! 

        timeOffset = endOfTrackTimestamp - previousTimestamp;
        variableLengthTime = getVariableLengthValue(timeOffset);
        variableLengthTimeLength = variableLengthTime.length;
        for (j = 0; j < variableLengthTimeLength; ++j)
        {
            dv.setUint8(offset++, variableLengthTime[j]);
        }

        controlChange = 0xB0 + trackMessages[0].channel;

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
    },

    // Returns a Uint8Array containing a track header
    getTrackHeader = function (dataLength)
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
    },

    // Returns a Uint8Array containing the MIDI header chunk
    getMIDIHeaderChunk = function (nTracks)
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
    },

    // Returns a UintArray containing a track chunk (track header + data)
    getTrackChunk = function (earliestTimestamp, trackMessages, endMarkerTimestamp)
    {
        var i, trackData, trackHeader, trackChunk;
        // earliestTimestamp - 200 and endMarkerTimestamp + 300 
        // so that the start and end of playback are not quite so abrupt.
        trackData = getTrackData(earliestTimestamp - 200, trackMessages, endMarkerTimestamp + 300);
        trackHeader = getTrackHeader(trackData.length);
        trackChunk = new Uint8Array(trackHeader.length + trackData.length);
        trackChunk.set(trackHeader, 0);
        trackChunk.set(trackData, trackHeader.length);

        return trackChunk;
    },

    // Returns an ArrayBuffer containing the complete standard MIDI file.
    midiTracksDataToArrayBuffer = function (earliestTimestamp, nTracks, midiTracksMessages, endMarkerTimestamp)
    {
        var i, trackChunk, trackChunks = [], trackChunksLength = 0,
        nPerformingTracks,
        midiHeaderChunk,
        offset,
        midiFileArrayBuffer, midiFileArray;

        for (i = 0; i < nTracks; ++i)
        {
            if (midiTracksMessages[i].length > 0)
            {
                trackChunk = getTrackChunk(earliestTimestamp, midiTracksMessages[i], endMarkerTimestamp);
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

        return midiFileArrayBuffer;
    },

    // Returns true if any of the tracks contain data, otherwise false.
    // Used to prevent the creation of a 'save' button when there is nothing to save.
    hasData = function (nTracks, midiTracksData)
    {
        var i, has = false;
        for (i = 0; i < nTracks; ++i)
        {
            if (midiTracksData[i].length > 0)
            {
                has = true;
                break;
            }
        }
        return has;
    },

    // Returns the name of the file to be downloaded
    // The date part of the name is formatted as
    //     year-month-day, with month and day always having two characters
    // so that downloaded files will list in order of creation time.
    getMIDIFileName = function (scoreName)
    {
        var 
        d = new Date(),
        dayOfTheMonth = (d.getDate()).toString(),
        month = (d.getMonth() + 1).toString(),
        year = (d.getFullYear()).toString(),
        downloadName;

        if (month.length === 1)
        {
            month = "0".concat(month);
        }

        if (dayOfTheMonth.length === 1)
        {
            dayOfTheMonth = "0".concat(dayOfTheMonth);
        }

        downloadName = scoreName.concat('_', year, '-', month, '-', dayOfTheMonth, '.mid'); // .mid is added in case scoreName contains a '.'.

        return downloadName;
    },

    // Creates a button which, when clicked, downloads a standard MIDI file recording of the Events stored in its
    // midiTracksData argument (see below).
    // The button is created in an otherwise empty div in the document. The div's id is "downloadLinkDiv".
    // The 'button' is actually a link element (an 'a' element) which is created on the fly and inserted in the div.
    // When it is clicked, the file downloads and then button is autpmatically deleted. The button can also be deleted
    // (with its associated recording) by calling deleteSaveMIDIFileButton().
    // Arguments:
    // scoreName is the name of the score. The name of the downloaded file is constructed as follows:
    //     scoreName + '_' + the current date (format:year-month-day) + '.mid' (e.g. "Sonata_2013-01-08.mid").        
    // midiTracksData contains a javascript array of arrays.
    //     Each inner array contains a simple, flat sequence of Events for a single track. The tracks do not contain
    //     Moments. The contained Events belong to their originating Sequence. They are not changed either by this
    //     function, or by clicking the 'save' button.
    // endMarkerTimestamp is the duration of each track in milliseconds.
    // mouseOverButtonImageName and mouseOutButtonImageName are the relative names of two images to be used to display
    // the button (link). For example: "images/saveMouseOver.png" and "images/saveMouseOut.png".
    // imgWidth and imgHeight are the dimensions of the link images in pixels.  
    createSaveMIDIFileButton = function (scoreName, midiTracksData, endMarkerTimestamp,
                                         mouseOverButtonImageName, mouseOutButtonImageName, imgWidth, imgHeight)
    {
        var 
        midiArray,
        blob,
        downloadName,
        downloadLinkDiv, a,
        earliestTimestamp,
        nTracks = midiTracksData.length;

        if (hasData(nTracks, midiTracksData))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the empty Element which will contain the link
            downloadName = getMIDIFileName(scoreName);

            earliestTimestamp = getEarliestTimestamp(nTracks, midiTracksData);

            midiArray = midiTracksDataToArrayBuffer(earliestTimestamp, nTracks, midiTracksData, endMarkerTimestamp);
            blob = new Blob([midiArray], { type: 'audio/midi' });

            a = document.createElement('a');
            a.id = "downloadLink";
            a.download = downloadName;
            a.href = window.URL.createObjectURL(blob); // window.URL is set in jiMain.js
            //a.innerHTML = '<img id="saveImg" border="0" src="images/saveMouseOut.png" alt="saveMouseOutImage" width="56" height="31">';
            a.innerHTML = '<img id="saveImg" border="0" src=\"' + mouseOverButtonImageName + '\" alt=\"' + mouseOutButtonImageName +
                             '\" width=\"' + imgWidth + '\" height=\"' + imgHeight + '\">';

            a.onmouseover = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = mouseOverButtonImageName;
                a.style.cursor = 'default';
            };

            a.onmouseout = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = mouseOutButtonImageName;
            };

            a.onclick = function (e)
            {
                deleteSaveMIDIFileButton();
            };

            downloadLinkDiv.appendChild(a);
        }
    },

    publicAPI =
    {
        createSaveMIDIFileButton: createSaveMIDIFileButton,
        deleteSaveMIDIFileButton: deleteSaveMIDIFileButton
    };

    return publicAPI;

} (document, window));

