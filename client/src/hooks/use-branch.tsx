import { createContext, useContext, useState, useEffect } from "react";

interface BranchContextType {
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number | null) => void;
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem("pdks_selected_branch");
    return stored ? parseInt(stored) : null;
  });

  const setSelectedBranchId = (id: number | null) => {
    setSelectedBranchIdState(id);
    if (id === null) {
      localStorage.removeItem("pdks_selected_branch");
    } else {
      localStorage.setItem("pdks_selected_branch", String(id));
    }
  };

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
