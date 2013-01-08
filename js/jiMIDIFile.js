/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMIDIFile.js
 *  The JI_NAMESPACE.midiFile namespace containing two functions
 *      load(midiFileURI)   // loads the midi file into an ordinary javascript array of numbers.
 *                          // The array is at the base level in this namespace.
 *      
 *      createSaveButton()          // downloads the array (set by load()) as a MIDI file. 
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.midiFile');

JI_NAMESPACE.midiFile = (function (document, window)
{
    "use strict";

    var 
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

    variableLengthValueLength = function (timeOffset)
    {
        var length;

        if (timeOffset < 0)
        {
            throw "Error: timeOffset may not be negative.";
        }
        else if (timeOffset < 128) // 7 bits, 8th bit is 2^7 == 128
        {
            length = 1;
        }
        else if (timeOffset < 16384) // 14 bits, 15th bit is 2^14 == 16384
        {
            length = 2;
        }
        else if (timeOffset < 2097152) // 21 bits, 22nd bit is 2^21 == 2097152
        {
            length = 3;
        }
        else if (timeOffset < 268435456) // 28 bits, 29th bit is 2^28 == 268435456
        {
            length = 4;
        }
        else
        {
            throw "Error: timeOffset out of range";
        }

        return length;
    },

    // returns a Uint8Array of the correct length, containing the
    // argument value as a MIDI 'Variable Length Value'.
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

    getTrackDataLength = function (midiMessages)
    {
        var 
        i, nMessages = midiMessages.length, msg,
        dataLength = 0, currentTime = 0, timeOffset;

        for (i = 0; i < nMessages; ++i)
        {
            msg = midiMessages[i];
            timeOffset = msg.timestamp - currentTime;
            currentTime = msg.timestamp;

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
        dataLength += 4; // end of track event: 0x00, 0xFF, 0x2F, 0x00

        return dataLength;
    },

    // returns a Uint8Array containing track data
    getTrackData = function (trackMessages)
    {
        var i, nMessages = trackMessages.length, msg,
        dataLength = getTrackDataLength(trackMessages),
        buffer = new ArrayBuffer(dataLength),
        trackData = new Uint8Array(buffer),
        currentTime = 0, timeOffset,
        variableLengthTime, j, variableLengthTimeLength,
        dv = new DataView(buffer), offset = 0;

        for (i = 0; i < nMessages; ++i)
        {
            msg = trackMessages[i];
            timeOffset = msg.timestamp - currentTime;
            currentTime = msg.timestamp;

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

        dv.setUint32(offset, 0xFF2F00); // end of track event

        return trackData;
    },

    // returns a Uint8Array containing a track header
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

    // returns a Uint8Array containing the MIDI header chunk
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

    getTrackChunk = function (trackMessages)
    {
        var i, trackData, trackHeader, trackChunk;

        trackData = getTrackData(trackMessages); // trackData includes EndOfTrack event
        trackHeader = getTrackHeader(trackData.length);
        trackChunk = new Uint8Array(trackHeader.length + trackData.length);
        trackChunk.set(trackHeader, 0);
        trackChunk.set(trackData, trackHeader.length);

        return trackChunk;
    },

    // This function returns an ArrayBuffer containing the MIDI file as byte data.
    // midiTracksMessages is an array of arrays. Each contained array contains the midiMessages for one track.
    // The AssistantPerformer uses one track per channel, and vice versa.
    // Each midiMessage has its timestamp set to the value it had in the performance (re the start of the performance).
    midiTracksDataToArrayBuffer = function (nTracks, midiTracksMessages)
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
                trackChunk = getTrackChunk(midiTracksMessages[i]);
                trackChunksLength += trackChunk.length;
                trackChunks.push(trackChunk);
            }
            // Empty the midiTracksMessages when it has been used (so that it can be re-used).
            midiTracksMessages[i] = [];
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

    getDownloadName = function (scoreName)
    {
        var 
        d = new Date(),
        dayOfTheMonth = d.getDate(),
        month = d.getMonth() + 1,
        year = d.getFullYear(),
        downloadName = scoreName.concat('_', year, '-', month, '-', dayOfTheMonth, '.mid'); // .mid is added in case scoreName contains a '.'.

        return downloadName;
    },


    // Creates a link with which the user can createSaveButton a recording of the performance as a MIDI file.
    // The link is deleted when the file has been downloaded or when a new performance is started.
    // The scoreName is the name of the score (as selected in the main score selector).
    // midiTracksData contains ordinary javascript arrays of numbers, containing the byte values for the MIDI file.
    // midiTracksData is returned by the sequencer when it calls reportEndOfPerformance(). 
    createSaveMIDIFileButton = function (scoreName, midiTracksData)
    {
        var 
        midiArray,
        blob,
        downloadName,
        downloadLinkDiv, a,
        nTracks = midiTracksData.length;

        if (hasData(nTracks, midiTracksData))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the empty Element which will contain the link
            downloadName = getDownloadName(scoreName);

            midiArray = midiTracksDataToArrayBuffer(nTracks, midiTracksData);
            blob = new Blob([midiArray], { type: 'audio/midi' });

            a = document.createElement('a');
            a.id = "downloadLink";
            a.download = downloadName;
            a.href = window.URL.createObjectURL(blob); // window.URL is set in jiMain.js
            a.innerHTML = '<img id="saveImg" border="0" src="images/saveMouseOut.png" alt="saveMouseOutImage" width="56" height="31">';

            a.onmouseover = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = "images/saveMouseOver.png";
                a.style.cursor = 'default';
            };

            a.onmouseout = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = "images/saveMouseOut.png";
            };

            a.onclick = function (e)
            {
                deleteSaveMIDIFileButton();
            };

            downloadLinkDiv.appendChild(a);
        }
    },

    // public API
    publicAPI =
    {
        createSaveMIDIFileButton: createSaveMIDIFileButton,
        deleteSaveMIDIFileButton: deleteSaveMIDIFileButton
    };

    return publicAPI;

} (document, window));

