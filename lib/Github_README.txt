/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiWebMIDIAPI.js
 *  This file defines the JI_WEB_MIDI_API.jazzWebMIDI namespace which implements
 *  the W3C Web MIDI API using the Jazz plugin.
 *  All other namespaces in JI_WEB_MIDI_API depend on this jazzWebMIDI namespace,
 *  and will continue to do so until browsers implement it natively.
 *  When that happens, the Jazz plugin can be uninstalled, and this file removed. 
 *  
 *  The W3C Web MIDI API is defined in the latest version at the spec's
 *  Github repository:
 *      http://webaudio.github.com/web-midi-api/
 *
 *  Most of this file (jiWebMIDIAPI.js) was originally copied from parts of
 *  abudaan's JazzMIDIBridge:
 *      https://github.com/abudaan/JazzMIDIBridge
 *  
 *  Changes to the Web MIDI API itself will affect this library. Ideally, some way
 *  might be found to update it automatcally, but until then I'll be updating manually.
 *  I have subscribed to the above webaudio repositiory, and should be getting
 *  automatic notification of changes.
 *
 *  Currently (17.01.2013) the web MIDI API defines the following objects and attributes:
 *
 *      MIDIAccess
 *          attributes: enumerateInputs
 *                      enumerateOutputs
 *                      getInput
 *                      getOutput
 *
 *      MIDIPort
 *          attributes: id              // the index of the port in the enumerateInputs or enumerateOutputs array
 *                      manufacturer    // not supported by Jazz 1.2. This implementation returns "<manufacturer unknown>".
 *                      name            // the name of the port in the enumerateInputs or enumerateOutputs array
 *                      type            // either 'input' or 'output'
 *                      version         // not supported by Jazz 1.2. This implementation returns "<version unknown>".
 *
 *      MIDIInput : MIDIPort
 *          attributes: onmessage   // callback(data), called when midi data arrives at an input port.
 *
 *      MIDIOutput : MIDIPort
 *          attributes: send        // send(sequence<short> data, optional DOMHighResTimeStamp? timestamp)
 *
 *      MIDIEvent
 *          attributes: timestamp   // double
 *                      data        // sequence<Uint8>
 *
 *  jiWebMIDIAPI.js (this file) will become redundant as soon as browsers begin
 *  to implement the above objects natively.      
 *
 *  The JI_WEB_MIDI_API has the following namespaces:
 *
 *  JI_WEB_MIDI_API.event -- defined in lib/Event.js
 *      1. MIDI constants. These constants are categorised and defined in the following objects:
 *                  COMMAND
 *                  RUNNING_STATUS
 *                  CONTROL
 *                  SYSTEM_EXCLUSIVE
 *      2. Event(status, data1, data2, timestamp) for constructing 1- 2- or 3-byte MIDI events
 *         which are not SysExEvents. 1-byte Events are "running status".
 *         The Web MIDI API MIDIEvent is this Event's public interface.
 *      3. SysExEvent(data, timestamp) for explicitly constructing system exclusive events.
 *      4. function getEvent(data, timestamp) for constructing any kind of event. This function
 *         can be used to construct events when their type is not known in advance (e.g. when
 *         reading an input stream). Note that the timestamp argument is relative to some fixed
 *         time. It is not, as in standard MIDI files, relative to the previous event. 
 *      5. the functions to14Bit(value) and from14Bit(data1, data2). For dealing with PITCH_WHEEL
 *         events.
 *
 *  JI_WEB_MIDI_API.moment -- defined in lib/Moment.js
 *  Moment
 *      A Moment contains Events, all of which have the same timestamp.
 *
 *  JI_WEB_MIDI_API.track -- defined in lib/Track.js
 *  Track
 *      A Track contains Moments, whose timestamps are in ascending order.
 *
 *  JI_WEB_MIDI_API.sequence -- defined in lib/Sequence.js
 *  Sequence
 *      A Sequence contains parallel Tracks all starting at the same timestamp.
 *
 *  JI_WEB_MIDI_API.standardMIDIFile -- defined in lib/StandardMIDIFile.js
 *  Conversion Functions:
 *      Convert an in-memory Sequence to a Standard MIDI File:
 *          smf = sequenceToSMF(sequence)
 *      Convert a Standard MIDI File to an in-memory Sequence:
 *          sequence = smfToSequence(standardMIDIFile)       
 */


 *         Issue: Should the code for this event be incorporated in browsers? In other words:
 *         Should MIDIEvent have a constructor? This is currently an issue on the Web MIDI API
 *         Github site.