// SPDX-License-Identifier: MPL-2.0
// Study 34 · io: Kairotic's events in SuperCollider, through the relay's OSC bridge (discussion #135).
//
// 1. npx @kairotic/relay --osc        (the pages' OSC goes to sclang, 127.0.0.1:57120)
// 2. In the study: Connect OSC, tick "send every event as OSC", play the keyboard, a pad, the phone…
// 3. Evaluate the block below in SuperCollider.

(
s.waitForBoot {
	SynthDef(\kairotic, { |freq = 440, amp = 0.3, gate = 1|
		var env = EnvGen.kr(Env.adsr(0.01, 0.2, 0.7, 0.4), gate, doneAction: 2);
		Out.ar(0, Pan2.ar(VarSaw.ar(freq.lag(0.02), 0, 0.3) * env * amp * 0.4));
	}).add;
	~voices = ();
	// /kairotic/note id freq amp gate
	OSCdef(\kairoticNote, { |msg|
		var id = msg[1], freq = msg[2], amp = msg[3], gate = msg[4];
		~voices[id] !? { |v| v.release };
		~voices[id] = if (gate == 1) { Synth(\kairotic, [freq: freq, amp: amp]) } { nil };
	}, '/kairotic/note');
	// /kairotic/glide id freq — an MPE bend, a gamepad's stick, a phone's tilt
	OSCdef(\kairoticGlide, { |msg| ~voices[msg[1]] !? { |v| v.set(\freq, msg[2]) } }, '/kairotic/glide');
	// anything else under /kairotic, printed
	OSCdef(\kairoticTilt, { |msg| msg.postln }, '/kairotic/tilt');
};
)

// And the other way: SuperCollider playing into the page (the relay listens on udp 57121).
~kairotic = NetAddr("127.0.0.1", 57121);
~kairotic.sendMsg("/kairotic/note", 1, 7/4 * 261.6256, 0.6, 1);   // a 7/4 above middle C
~kairotic.sendMsg("/kairotic/glide", 1, 2 * 261.6256);            // gliding to the octave
~kairotic.sendMsg("/kairotic/note", 1, 0, 0, 0);                  // and off
~kairotic.sendMsg("/any/address", 0.5, "text");                   // arrives as {:type :osc …}
