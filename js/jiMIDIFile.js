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
    // temporary variable. Delete when deleting the load() and createSaveButton() functions 
    TEMP_midiArray = [], // the loaded and downloaded midiArray (an ordinary javascript array of numbers)

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

    // This function returns a single (ordinary javascript) array of numbers containing the byte data for a MIDI file.
    // midiTracksData is an array of arrays, containing the MIDIMessages for each track.
    // The AssistantPerformer uses one track per channel, and vice versa.
    // Each midiMessage has its timestamp set to the value it had in the performance (re the start of the performance).

    midiTracksDataToFileArray = function (nTracks, midiTracksData)
    {
        var i;

        TEMP_midiArray.push(1);
        TEMP_midiArray.push(2);
        TEMP_midiArray.push(3);
        TEMP_midiArray.push(4);
        TEMP_midiArray.push(5);
        TEMP_midiArray.push(6);
        TEMP_midiArray.push(7);

        // Empty the midiTracksData when it has been used (so that it can be re-used).
        for (i = 0; i < nTracks; ++i)
        {
            midiTracksData[i] = [];
        }

        return TEMP_midiArray;
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
        i, nTracks = midiTracksData.length;

        if (hasData(nTracks, midiTracksData))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the empty Element which will contain the link
            downloadName = getDownloadName(scoreName);

            midiArray = midiTracksDataToFileArray(nTracks, midiTracksData);
            blob = new Blob(midiArray, { type: 'audio/midi' });

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

    // loads the midi file at midiURL into TEMP_midiArray.
    load = function (midiURL)
    {
        TEMP_midiArray.push(1);
        TEMP_midiArray.push(2);
        TEMP_midiArray.push(3);
        TEMP_midiArray.push(4);
        TEMP_midiArray.push(5);
        TEMP_midiArray.push(6);
        TEMP_midiArray.push(7);
    },

    // Creates a link with which the user can download TEMP_midiArray as a MIDI file.
    createSaveButton = function ()
    {
        createSaveMIDIFileButton("temp", null);
    },

    // public API
    publicAPI =
    {
        // test functions
        load: load,
        createSaveButton: createSaveButton,

        // the real API
        createSaveMIDIFileButton: createSaveMIDIFileButton,
        deleteSaveMIDIFileButton: deleteSaveMIDIFileButton
    };

    return publicAPI;

} (document, window));

