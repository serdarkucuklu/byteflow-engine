import {LezerHighlighter} from '@motion-canvas/2d';
import {parser} from '@lezer/python';
import {HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {COLORS} from './spec';

// ByteFlow dark kod teması — GitHub-dark benzeri, marka paletiyle uyumlu.
const byteflowStyle = HighlightStyle.define([
  {tag: tags.keyword, color: '#ff7b72'},
  {tag: tags.function(tags.variableName), color: '#d2a8ff'},
  {tag: tags.function(tags.propertyName), color: '#d2a8ff'},
  {tag: tags.string, color: '#a5d6ff'},
  {tag: tags.number, color: '#79c0ff'},
  {tag: tags.comment, color: COLORS.muted, fontStyle: 'italic'},
  {tag: tags.operator, color: '#ff7b72'},
  {tag: tags.propertyName, color: '#79c0ff'},
  {tag: tags.variableName, color: COLORS.text},
  {tag: tags.controlKeyword, color: '#ff7b72'},
  {tag: tags.definitionKeyword, color: '#ff7b72'},
]);

export const byteflowHighlighter = new LezerHighlighter(parser, byteflowStyle);
