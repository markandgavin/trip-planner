import {
  Briefcase,
  Building2,
  Car,
  MapPin,
  Plane,
  BedDouble,
  Warehouse,
  UtensilsCrossed,
  User,
  type LucideProps,
} from 'lucide-react';
import type { StopType, TravelMode } from '@/types/itinerary';

export function StopTypeIcon({ type, ...props }: { type?: StopType } & LucideProps) {
  switch (type) {
    case 'hotel':
      return <BedDouble {...props} />;
    case 'airport':
      return <Plane {...props} />;
    case 'office':
      return <Building2 {...props} />;
    case 'warehouse':
      return <Warehouse {...props} />;
    case 'restaurant':
      return <UtensilsCrossed {...props} />;
    case 'personal':
      return <User {...props} />;
    case 'job':
      return <Briefcase {...props} />;
    default:
      return <MapPin {...props} />;
  }
}

export function ModeIcon({ mode, ...props }: { mode: TravelMode } & LucideProps) {
  return mode === 'flight' ? <Plane {...props} /> : <Car {...props} />;
}
