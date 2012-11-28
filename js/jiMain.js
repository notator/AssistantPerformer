/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMain.js
 *  The main entry point when using the JazzMidiBridge plugin.
 *  Sets up the MIDI input and output device selectors in the Assistant Performer's GUI,
 *  and initialises the JI_NAMESPACE.midiChord namespace with a pointer to JMB, allowing
 *  MIDIMessages to be constructed there.
 *  
 */

window.addEventListener("load", function ()
{
    "use strict";

    var apControls = JI_NAMESPACE.apControls,
        jiAssistant = JI_NAMESPACE.assistant,
        jiMIDIChord = JI_NAMESPACE.midiChord,
        selectInput = document.getElementById("midiInputDeviceSelector"),
        selectOutput = document.getElementById("midiOutputDeviceSelector"),
        inputDeviceId = "",
        outputDeviceId = "",
        messageCreationData; // utilities for creating MIDI messages

    JMB.init(function (MIDIAccess)
    {
        var inputs = MIDIAccess.enumerateInputs(),
            outputs = MIDIAccess.enumerateOutputs(),

        // sets the current devices in apControls.options
            connectDevices = function ()
            {
                if (apControls !== undefined)
                {
                    apControls.setMidiDevices(MIDIAccess, inputDeviceId, outputDeviceId);
                }

                /********
                // ji -- commented out 28.10.12 
                if (apControls !== undefined && output !== null)
                {
                apControls.setMidiOut(output);
                }

                // the input device is now connected and disconnected dynamically inside jiAssistant.js
                if (input)
                {
                input.addEventListener("midimessage", function (msg)
                {
                if (apControls !== undefined && apControls.handleMidiIn !== undefined)
                {
                apControls.handleMidiIn(msg);
                }
                else if (output)
                {
                output.sendMIDIMessage(msg);
                }
                });
                }
                *********/
            };

        //create dropdown menu for MIDI inputs
        JMB.createMIDIDeviceSelector(selectInput, inputs, "input", function (deviceId)
        {
            inputDeviceId = deviceId;
            connectDevices();
        });

        //create dropdown menu for MIDI outputs
        JMB.createMIDIDeviceSelector(selectOutput, outputs, "output", function (deviceId)
        {
            outputDeviceId = deviceId;
            connectDevices();
        });

        // ji addition
        messageCreationData =
        {
            createMIDIMessage: MIDIAccess.createMIDIMessage,
            // MIDI commands
            NOTE_OFF: 0x80,
            NOTE_ON: 0x90,
            CONTROL_CHANGE: 0xB0,
            PROGRAM_CHANGE: 0xC0,
            CHANNEL_PRESSURE: 0xD0,
            PITCH_BEND: 0xE0,
            // MIDI controls
            PAN_CONTROL: 10,
            MODWHEEL_CONTROL: 1,
            EXPRESSION_CONTROL: 11
        };
    });

    apControls.init();
    jiAssistant.init(messageCreationData);
    jiMIDIChord.init(messageCreationData);

}, false);
