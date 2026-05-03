import { Crown } from 'lucide-react';

interface UpgradeButtonProps {
    onClick?: () => void;
    label?: string;
    className?: string;
}

export const UpgradeButton = ({ onClick, label = "ترقية للنسخة الكاملة", className = "" }: UpgradeButtonProps) => {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 ${className}`}
        >
            <Crown size={20} fill="currentColor" />
            <span>{label}</span>
        </button>
    );
};
