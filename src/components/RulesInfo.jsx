import React from 'react';
import { motion } from 'framer-motion';
import { Scroll, BeerBottle, Trophy, Flag } from '@phosphor-icons/react';
import { PageHeader, Card, SectionLabel, Chip } from './common';

const fineRules = [
  { id: 'ThreePutt', label: '3 Putt', penalty: '1 Shot', description: 'Taking 3 or more putts on a single green' },
  { id: 'FourPutt', label: '4 Putt', penalty: 'Beer Down', description: 'Taking 4 or more putts on a single green - must finish your beer' },
  { id: 'BunkerToBunker', label: 'Bunker to Bunker', penalty: '1 Shot', description: 'Going from one bunker directly into another bunker' },
  { id: 'RestingOnClub', label: 'Resting on Club', penalty: '1 Shot', description: 'Leaning or resting on your club in the bunker (grounding the club)' },
  { id: 'Shank', label: 'Shank', penalty: '1 Shot', description: 'Hitting the ball with the hosel, sending it sharply to the right (for right-handers)' },
  { id: 'NotPastLadies', label: 'Not Past Ladies', penalty: '1 Shot', description: 'Tee shot does not reach the ladies tee box' },
  { id: 'SandSpecialist', label: 'Sand Specialist', penalty: '1 Shot', description: 'Taking 2 or more shots to get out of a bunker' },
];

const awardRules = [
  { title: 'Champion (Stableford)', description: 'Highest total stableford points across all rounds' },
  { title: 'Champion (Stroke Play)', description: 'Lowest total strokes across all rounds' },
  { title: 'Best Front 9', description: 'Best stableford score on front 9 holes across all rounds' },
  { title: 'Best Back 9', description: 'Best stableford score on back 9 holes across all rounds' },
  { title: 'Most 2s', description: 'Player with the most 2-point scores (birdies/eagles)' },
  { title: 'Most Birdies', description: 'Player with the most birdies across all rounds' },
  { title: 'Best Gross', description: 'Best gross score relative to par' },
  { title: 'Most Improved', description: 'Biggest improvement from first half to second half of season' },
  { title: 'Wooden Spoon', description: 'Worst overall score across all rounds' },
];

const specialHoles = [
  { title: 'Beer Hole', description: 'Player with most shots (net) buys drinks for the group', color: 'amber' },
  { title: 'Joker Hole', description: 'Double points scored on this hole', color: 'purple' },
];


const RulesInfo = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-4xl pb-12"
    >
      <PageHeader
        eyebrow="House rules"
        title="Rules & Info"
        icon={<Scroll size={27} weight="duotone" />}
        lede="Fines, awards and the special holes — everything the tour runs on."
      />

      {/* Special holes */}
      <Card className="mb-5 p-5">
        <SectionLabel icon={<Flag size={14} weight="duotone" />} className="mb-4">Special holes</SectionLabel>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {specialHoles.map((hole, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                hole.color === 'amber'
                  ? 'border-rose-500/25 bg-rose-500/8'
                  : 'border-purple-500/25 bg-purple-500/8'
              }`}
            >
              <span className="shrink-0 text-xl leading-none">{hole.color === 'amber' ? '🍺' : '🎭'}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{hole.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#A9C5B4]">{hole.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fines */}
      <Card className="mb-5 p-5">
        <SectionLabel
          icon={<BeerBottle size={14} weight="duotone" />}
          className="mb-4"
          trailing={<Chip>{fineRules.length} rules</Chip>}
        >
          Fines
        </SectionLabel>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {fineRules.map((fine) => (
            <div
              key={fine.id}
              className="flex items-start gap-3 rounded-xl border border-[#D4AF37]/10 bg-[#03110A]/50 p-3.5 transition-colors hover:border-[#D4AF37]/25"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{fine.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#A9C5B4]">{fine.description}</p>
              </div>
              <span
                className={`pg-chip shrink-0 ${
                  fine.penalty === 'Beer Down' ? 'pg-chip-rose' : 'pg-chip-amber'
                }`}
              >
                {fine.penalty}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Awards */}
      <Card className="p-5">
        <SectionLabel
          icon={<Trophy size={14} weight="duotone" />}
          className="mb-4"
          trailing={<Chip>{awardRules.length} awards</Chip>}
        >
          Awards
        </SectionLabel>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {awardRules.map((award, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-[#03110A]/45"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{award.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#A9C5B4]">{award.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
};

export default RulesInfo;
