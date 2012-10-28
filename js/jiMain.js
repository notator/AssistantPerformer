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
        jiMIDIChord = JI_NAMESPACE.midiChord,
        selectInput = document.getElementById("midiInputDeviceSelector"),
        selectOutput = document.getElementById("midiOutputDeviceSelector"),
        input = null,
        output = null;

    JMB.init(function (MIDIAccess)
    {
        var inputs = MIDIAccess.enumerateInputs(),
            outputs = MIDIAccess.enumerateOutputs(),

            // sets the current devices in apControls.options
            connectDevices = function ()
            {
                if (apControls !== undefined)
                {
                    apControls.setMidiDevices(input, output);
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
            if (input)
            {
                input.close();
            }
            input = MIDIAccess.getInput(deviceId);
            connectDevices();
        });

        //create dropdown menu for MIDI outputs
        JMB.createMIDIDeviceSelector(selectOutput, outputs, "output", function (deviceId)
        {
            if (output)
            {
                output.close();
            }
            output = MIDIAccess.getOutput(deviceId);
            connectDevices();
        });

        // ji addition
        JMB.createMIDIMessage = MIDIAccess.createMIDIMessage;
    });

    apControls.init();
    jiMIDIChord.init(JMB);

}, false);
