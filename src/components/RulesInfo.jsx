import React from 'react';
import { motion } from 'framer-motion';
import { Scroll, BeerBottle, Trophy, Flag } from '@phosphor-icons/react';

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
      className="max-w-4xl mx-auto pb-12"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-sans font-bold text-[#D4AF37] tracking-tight flex items-center gap-3">
          <Scroll size={32} weight="duotone" />
          Rules & Info
        </h2>
        <p className="text-sm text-[#A9C5B4] mt-1">
          Everything you need to know about fines, awards, and tour rules
        </p>
      </div>

      {/* Special Holes Section */}
      <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-4 mb-6">
        <h3 className="text-lg font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
          <Flag size={24} weight="duotone" />
          Special Holes
        </h3>
        <div className="space-y-3">
          {specialHoles.map((hole, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-[#051A10]/50 border border-[#D4AF37]/10">
              <div className="flex-shrink-0">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  hole.color === 'amber' 
                    ? 'border-amber-500 text-amber-400' 
                    : 'border-purple-500 text-purple-400'
                }`}>
                  <span className="text-xs font-bold">{hole.color === 'amber' ? 'B' : 'J'}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{hole.title}</p>
                <p className="text-xs text-[#A9C5B4]">{hole.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fines Section */}
      <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-4 mb-6">
        <h3 className="text-lg font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
          <BeerBottle size={24} weight="duotone" />
          Fines Rules
        </h3>
        <div className="space-y-3">
          {fineRules.map((fine) => (
            <div key={fine.id} className="flex items-start gap-3 p-3 rounded-lg bg-[#051A10]/50 border border-[#D4AF37]/10">
              <div className="flex-shrink-0 w-16 text-center">
                <span className="text-xs font-bold text-red-400 uppercase">{fine.penalty}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{fine.label}</p>
                <p className="text-xs text-[#A9C5B4]">{fine.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Awards Section */}
      <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-4 mb-6">
        <h3 className="text-lg font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
          <Trophy size={24} weight="duotone" />
          Awards Descriptions
        </h3>
        <div className="space-y-2">
          {awardRules.map((award, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#051A10]/30 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{award.title}</p>
                <p className="text-xs text-[#A9C5B4]">{award.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </motion.div>
  );
};

export default RulesInfo;
