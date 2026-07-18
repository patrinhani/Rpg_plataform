import { vincularVttMesa } from '../../lib/vtt-mesa-link.js';
import VttLab from './VttLab.jsx';

export default function VttLabIntegrated() {
  return <VttLab onPersistLinkedRoom={vincularVttMesa} />;
}
