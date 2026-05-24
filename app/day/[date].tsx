import { TodayScreen } from '@/features/journal/screens/today-screen';

// The journal screen handles both the today tab (no `date` param) and any
// past day via `/day/[date]`. Same UI, same edit affordances.
export default TodayScreen;
