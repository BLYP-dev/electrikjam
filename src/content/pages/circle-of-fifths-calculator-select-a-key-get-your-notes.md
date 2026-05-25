---
id: 17126
type: "page"
wpSlug: "circle-of-fifths-calculator-select-a-key-get-your-notes"
path: "/circle-of-fifths-calculator-select-a-key-get-your-notes/"
url: "https://www.electrikjam.com/circle-of-fifths-calculator-select-a-key-get-your-notes/"
title: "Circle of Fifths Calculator: Select A Key, Get Your Notes"
excerpt: ""
date: "2025-04-08T11:31:04+00:00"
modified: "2025-04-08T11:31:06+00:00"
author: "Richard"
authorSlug: "electrikjam"
categories: []
categorySlugs: []
tags: []
tagSlugs: []
featuredImageAlt: ""
seo: 
  title: "Circle of Fifths Calculator: Select A Key, Get Your Notes"
  description: ""
  canonical: "https://www.electrikjam.com/circle-of-fifths-calculator-select-a-key-get-your-notes/"
---


<div class="custom-snippet-div"></p>



<style>
  .circle-container {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
    font-family: inherit;
  }

  .circle-svg text {
    cursor: pointer;
    fill: currentColor;
    font-size: 14px;
  }

  .key-info {
    margin-top: 1.5rem;
    font-family: inherit;
    color: inherit;
  }

  .key-info h3 {
    margin-bottom: 0.5rem;
  }
</style>

<div class="circle-container">
  <svg class="circle-svg" width="300" height="300" viewBox="0 0 300 300">
    <g transform="translate(150,150)">
      <text x="0" y="-130" text-anchor="middle" onclick="selectKey('C')">C</text>
      <text x="65" y="-112" text-anchor="middle" onclick="selectKey('G')">G</text>
      <text x="112" y="-65" text-anchor="middle" onclick="selectKey('D')">D</text>
      <text x="130" y="0" text-anchor="middle" onclick="selectKey('A')">A</text>
      <text x="112" y="65" text-anchor="middle" onclick="selectKey('E')">E</text>
      <text x="65" y="112" text-anchor="middle" onclick="selectKey('B')">B</text>
      <text x="0" y="130" text-anchor="middle" onclick="selectKey('F#')">F#</text>
      <text x="-65" y="112" text-anchor="middle" onclick="selectKey('Db')">Db</text>
      <text x="-112" y="65" text-anchor="middle" onclick="selectKey('Ab')">Ab</text>
      <text x="-130" y="0" text-anchor="middle" onclick="selectKey('Eb')">Eb</text>
      <text x="-112" y="-65" text-anchor="middle" onclick="selectKey('Bb')">Bb</text>
      <text x="-65" y="-112" text-anchor="middle" onclick="selectKey('F')">F</text>
    </g>
  </svg>

  <div class="key-info" id="keyInfo">
    <h3>Click a key to get started</h3>
  </div>
</div>

<script>
  const keyData = {
    C: {
      scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      relativeMinor: 'A Minor',
      chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']
    },
    G: {
      scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      relativeMinor: 'E Minor',
      chords: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']
    },
    D: {
      scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      relativeMinor: 'B Minor',
      chords: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim']
    },
    A: {
      scale: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      relativeMinor: 'F# Minor',
      chords: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim']
    },
    E: {
      scale: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      relativeMinor: 'C# Minor',
      chords: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim']
    },
    B: {
      scale: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
      relativeMinor: 'G# Minor',
      chords: ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#dim']
    },
    'F#': {
      scale: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
      relativeMinor: 'D# Minor',
      chords: ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim']
    },
    'Db': {
      scale: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
      relativeMinor: 'Bb Minor',
      chords: ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim']
    },
    'Ab': {
      scale: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
      relativeMinor: 'F Minor',
      chords: ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim']
    },
    'Eb': {
      scale: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
      relativeMinor: 'C Minor',
      chords: ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim']
    },
    'Bb': {
      scale: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
      relativeMinor: 'G Minor',
      chords: ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim']
    },
    F: {
      scale: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      relativeMinor: 'D Minor',
      chords: ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']
    }
  };

  function selectKey(key) {
    const info = keyData[key];
    const container = document.getElementById('keyInfo');
    container.innerHTML = `
      <h3>${key} Major</h3>
      <p><strong>Scale:</strong> ${info.scale.join(' ')}</p>
      <p><strong>Relative Minor:</strong> ${info.relativeMinor}</p>
      <p><strong>Diatonic Chords:</strong> ${info.chords.join(' ')}</p>
    `;
  }
</script>


<h2 class="wp-block-heading"><strong>🎼 How To Use The Interactive Circle of Fifths</strong></h2>



<p>Tap any key on the circle to explore its musical possibilities. Once selected, you&#8217;ll see three useful things:</p>



<ul class="wp-block-list">
<li><strong>Major Scale</strong> – the seven notes that form the backbone of melodies in that key</li>



<li><strong>Relative Minor</strong> – the minor key that shares the same notes, great for switching up the mood</li>



<li><strong>Diatonic Chords</strong> – the seven chords built from that scale, which naturally sound good together</li>
</ul>



<p>This chart helps you quickly find the chords and scales that work well in any key — perfect for songwriting, improvisation, or just understanding how music fits together. It’s also a great way to learn how different keys relate to each other. Want to switch to a new key? Just tap another one on the circle.</p>



<p>It works on desktop and mobile, and it inherits your font settings for a seamless experience.</p>



<p></div>

