import { motion } from 'framer-motion';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { SiStremio } from "react-icons/si";
import RatingCard from './components/RatingCard';
import { addonConfig } from './config'; // Update this import

function App() {
  const manifestUrl = `${addonConfig.backendUrl}/manifest.json`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(manifestUrl)
      .then(() => toast.success('Manifest URL copied!'))
      .catch(() => toast.error('Failed to copy URL'));
  };

  const handleStremioWeb = () => {
    window.open(`https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`, '_blank');
  };

  const handleStremioApp = () => {
    window.location.href = `stremio://addon/${encodeURIComponent(manifestUrl)}`;
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-7xl mx-auto"
      >
        <div className="text-center mb-16">
          <motion.h1 
            className="text-4xl sm:text-6xl font-bold mb-6 gradient-text"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            Ratings Pro
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-300 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Your all-in-one movie and TV show ratings aggregator for Stremio
          </motion.p>
        </div>

        <motion.div 
          className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleCopy}
          >
            <FaCopy /> Copy URL
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleStremioWeb}
          >
            <FaExternalLinkAlt /> Stremio Web
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleStremioApp}
          >
            <SiStremio /> Open Stremio
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <RatingCard
            title="Multiple Sources"
            description="Aggregate ratings from IMDb, TMDb, Metacritic, and more"
            icon="🎯"
          />
          <RatingCard
            title="Parent Guidance"
            description="Get age ratings and content warnings from Common Sense Media"
            icon="👶"
          />
          <RatingCard
            title="Content Warnings"
            description="Detailed content warnings from CringeMDB"
            icon="⚠️"
          />
        </div>

        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <p className="text-gray-400">
            Version {addonConfig.version} • Made with ❤️ for Stremio
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;