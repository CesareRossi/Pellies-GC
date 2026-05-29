import React from 'react';
import { motion } from 'framer-motion';

const Overview = ({ data, onNav, archivedSeasons, onShareRecap }) => {
  // Extract Overview component from App.js
  // This will be a placeholder for now - need to extract the actual component
  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
      <h2 className="text-2xl font-bold text-[#D4AF37] mb-4">Overview</h2>
      <p className="text-[#A9C5B4]">Overview component - to be extracted from App.js</p>
    </motion.div>
  );
};

export default Overview;
