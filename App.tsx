
import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import FilterPanel from './components/FilterPanel';
import KeywordTable from './components/KeywordTable';
import KeywordDetail from './components/KeywordDetail';
import LoginModal from './components/LoginModal';
import DapModal from './components/DapModal';
import Mixer from './components/Mixer';
import { MOCK_KEYWORDS, CATEGORIES } from './data/mockData';
import { BOARD_DATA, BOARD_DISPLAY_INFO } from './data/boards';
import { VOLUME_RANGES, SESSION_KEY, SAVED_KEYWORDS_KEY } from './constants';
import type { KeywordData, SortField, SortOrder } from './types';
import { logActivity, subscribeToSharedHistory, saveSharedHistory, deleteSharedHistoryItem, saveSharedPin, deleteSharedPin, subscribeToSharedPins } from './lib/firebase';


interface SavedKeywordMeta {
  pinnedAt: string;
  unpinnedInExplorer: boolean;
  userName?: string;
}

const ALL_KEYWORDS: KeywordData[] = MOCK_KEYWORDS;

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('explorer');
  const [savedKeywords, setSavedKeywords] = useState<Record<string, SavedKeywordMeta>>(() => {
    const saved = localStorage.getItem(SAVED_KEYWORDS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [selectedVolumeRangeIndices, setSelectedVolumeRangeIndices] = useState<number[]>([]);

  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null);
  const [selectedSubBoardIds, setSelectedSubBoardIds] = useState<string[]>([]);
  const [isDapOpen, setIsDapOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const isDarkMode = false;
  const sidebarWidth = 250;

  const [user, setUser] = useState<{ name: string, email: string, password?: string } | null>(() => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  });

  const [mixerHistory, setMixerHistory] = useState<{
    date: string,
    mix: { boardLabel: string, keywords: { name: string, volume: number, id: string }[] }[]
  }[]>(() => {
    const saved = localStorage.getItem('pindata_mixer_historyv2');
    return saved ? JSON.parse(saved) : [];
  });

  const [pickedIds, setPickedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('pindata_mixed_picked_ids');
    if (!saved) return new Set();
    try {
      return new Set(JSON.parse(saved));
    } catch (e) {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(SAVED_KEYWORDS_KEY, JSON.stringify(savedKeywords));
  }, [savedKeywords]);

  // Firebase sync for mixer history if password is available
  useEffect(() => {
    if (user?.password) {
      const unsubHistory = subscribeToSharedHistory(user.password, (history) => {
        setMixerHistory(history);
      });
      const unsubPins = subscribeToSharedPins(user.password, (pins) => {
        const pinMap: Record<string, SavedKeywordMeta> = {};
        pins.forEach(p => {
          pinMap[p.keywordId] = {
            pinnedAt: p.pinnedAt,
            unpinnedInExplorer: false,
            userName: p.userName
          };
        });
        setSavedKeywords(pinMap);
      });
      return () => {
        unsubHistory();
        unsubPins();
      };
    } else {
      // If not logged in, load from local storage
      const savedHist = localStorage.getItem('pindata_mixer_historyv2');
      if (savedHist) setMixerHistory(JSON.parse(savedHist));

      const savedPins = localStorage.getItem(SAVED_KEYWORDS_KEY);
      if (savedPins) setSavedKeywords(JSON.parse(savedPins));
    }
  }, [user?.password]);

  useEffect(() => {
    const board = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
    if (board?.isParent) {
      const children = BOARD_DISPLAY_INFO.filter(b => b.parentId === board.id);
      setSelectedSubBoardIds(children.map(c => c.id));
    } else {
      setSelectedSubBoardIds([]);
    }
  }, [activeTab]);

  const toggleSubBoard = (id: string) => {
    setSelectedSubBoardIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!user?.password) {
      localStorage.setItem('pindata_mixer_historyv2', JSON.stringify(mixerHistory));
    }
  }, [mixerHistory, user?.password]);

  useEffect(() => {
    localStorage.setItem('pindata_mixed_picked_ids', JSON.stringify(Array.from(pickedIds)));
  }, [pickedIds]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => {
      // If clicking an already selected category, remove it
      if (prev.includes(id)) {
        // Don't visualize empty state immediately if we want to allow unselecting all? 
        // Or if unselecting the last one, maybe select all others? 
        // Standard filter behavior: toggle on/off.
        return prev.filter(c => c !== id);
      } else {
        return [...prev, id];
      }
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    // Reset to all categories selected
    setSelectedCategories(CATEGORIES.map(c => c.id));
    setSelectedVolumeRangeIndices([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const toggleVolumeRange = (index: number) => {
    setSelectedVolumeRangeIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const toggleSaveKeyword = (id: string) => {
    if (!user) {
      setIsLoginOpen(true);
      return;
    }

    setSavedKeywords(prev => {
      const next = { ...prev };

      if (next[id]) {
        // Unpin
        delete next[id];
        if (user?.password) {
          deleteSharedPin(user.password, id);
        }
      } else {
        // Pin
        const pinnedAt = new Date().toLocaleDateString();
        next[id] = { pinnedAt, unpinnedInExplorer: false, userName: user?.name };
        if (user?.password) {
          saveSharedPin(user.password, user.name, id, pinnedAt);
        }
      }
      return next;
    });
  };

  const handleLogAction = (action: string, data: string) => {
    logActivity(user?.name || 'Guest User', action, data);
  };


  const filteredAndSortedData = useMemo(() => {
    let result = [...ALL_KEYWORDS];

    // Tab Filtering
    if (activeTab === 'saved') {
      result = result.filter(k => !!savedKeywords[k.id]);
    } else if (activeTab !== 'explorer') {
      // It's a board
      const boardKeywords = BOARD_DATA[activeTab] || [];
      // Filter strictly by name match for boards
      result = result.filter(k => boardKeywords.includes(k.name));

      // Sub-Board Interactive Filtering
      const boardInfo = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
      if (boardInfo?.isParent) {
        const children = BOARD_DISPLAY_INFO.filter(b => b.parentId === activeTab);
        const unselectedChildren = children.filter(c => !selectedSubBoardIds.includes(c.id));

        if (unselectedChildren.length > 0) {
          const forbiddenKeywords = new Set(unselectedChildren.flatMap(c => BOARD_DATA[c.id] || []));
          result = result.filter(k => !forbiddenKeywords.has(k.name));
        }
      }
    }

    // Search - ONLY apply search filter in Explorer tab
    if (activeTab === 'explorer' && searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(k => k.name.toLowerCase().includes(q));
    }

    // Category Filter (only applies if we have categories selected AND we are NOT in a specific board? 
    // Usually filters apply everywhere. Let's apply everywhere.)
    // However, if category filter is empty, show nothing? Or show all?
    // Initialize with ALL categories selected.
    if (selectedCategories.length > 0) {
      result = result.filter(k => selectedCategories.includes(k.category));
    } else {
      // If no categories selected, show nothing? Or all? Usually filters are additive. 
      // User initialized state with ALL categories.
      result = [];
    }

    // Volume Filter
    if (selectedVolumeRangeIndices.length > 0) {
      result = result.filter(k => {
        return selectedVolumeRangeIndices.some(idx => {
          const [min, max] = VOLUME_RANGES[idx].value;
          if (max === null) return k.volume >= min;
          return k.volume >= min && k.volume < max;
        });
      });
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      // Numbers
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [activeTab, savedKeywords, searchQuery, selectedCategories, selectedVolumeRangeIndices, sortField, sortOrder, selectedSubBoardIds]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );



  // View
  return (
    <div className={`flex min-h-screen font-sans ${isDarkMode ? 'bg-[#121216] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setCurrentPage(1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setSelectedKeyword(null);
        }}
        isLoggedIn={!!user}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        onLoginClick={() => setIsLoginOpen(true)}
        onLogoutClick={() => {
          setUser(null);
          localStorage.removeItem(SESSION_KEY);
        }}
        onDapClick={() => setIsDapOpen(true)}
        isDarkMode={isDarkMode}
        width={sidebarWidth}
      />

      <main
        className="flex-1 transition-all duration-300 p-8 pt-10"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-7xl mx-auto">
          {selectedKeyword ? (
            <KeywordDetail
              keyword={selectedKeyword}
              onBack={() => setSelectedKeyword(null)}
              isSaved={!!savedKeywords[selectedKeyword.id]}
              onToggleSave={toggleSaveKeyword}
              isDarkMode={isDarkMode}
              savedBy={savedKeywords[selectedKeyword.id]?.userName}
              boardName={(() => {
                if (activeTab === 'explorer' || activeTab === 'saved' || activeTab === 'mixer') return undefined;
                const board = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
                if (!board) return undefined;
                if (board.parentId) {
                  return BOARD_DISPLAY_INFO.find(b => b.id === board.parentId)?.label;
                }
                return board.label;
              })()}
              subBoardName={(() => {
                if (activeTab === 'explorer' || activeTab === 'saved' || activeTab === 'mixer') return undefined;
                const board = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
                if (board?.parentId) return board.label;
                return undefined;
              })()}
              onAction={handleLogAction}
            />
          ) : activeTab === 'mixer' ? (
            <Mixer
              allKeywords={ALL_KEYWORDS}
              isDarkMode={isDarkMode}
              history={mixerHistory}
              pickedIds={pickedIds}
              onDeleteHistory={(index) => {
                const itemToDelete = mixerHistory[index];
                if (user?.password && (itemToDelete as any).id) {
                  deleteSharedHistoryItem((itemToDelete as any).id);
                } else {
                  setMixerHistory(prev => prev.filter((_, i) => i !== index));
                }
              }}
              onSaveHistory={(mix) => {
                const date = new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                if (user?.password) {
                  saveSharedHistory(user.password, user.name, mix, date);
                } else {
                  // Fallback for local
                  setMixerHistory(prev => [{
                    date,
                    mix,
                    userName: user?.name
                  } as any, ...prev]);
                }

                // Update unique picked IDs
                const newIds = new Set(pickedIds);
                mix.forEach(group => group.keywords.forEach(kw => newIds.add(kw.id)));
                setPickedIds(newIds);
              }}
              onAction={handleLogAction}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setCurrentPage(1);
                setSearchQuery('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setSelectedKeyword(null);
              }}
            />

          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className={`text-4xl font-black tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {activeTab === 'explorer' ? 'Keyword Explorer' :
                      activeTab === 'saved' ? 'Saved Keywords' :
                        activeTab === 'mixer' ? 'Keyword List Generator' :
                          (() => {
                            const board = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
                            if (!board) return activeTab.split('-').slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                            if (board.parentId) {
                              const parent = BOARD_DISPLAY_INFO.find(b => b.id === board.parentId);
                              return (
                                <span className="flex flex-col">
                                  <span className="text-xl opacity-50 block mb-1">{parent?.label}</span>
                                  <span>{board.label}</span>
                                </span>
                              );
                            }
                            return board.label;
                          })()}
                  </h1>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-widest gap-2 shadow-sm transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white/60' : 'bg-white border-gray-100 text-gray-500'}`}>
                    <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Total Inventory</span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                    <span>{new Intl.NumberFormat().format(filteredAndSortedData.length)} Keywords</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-8 items-start">
                {/* Left Filter Panel */}
                <div className="hidden lg:block sticky top-8">
                  <FilterPanel
                    selectedCategories={selectedCategories}
                    onToggleCategory={toggleCategory}
                    selectedVolumeRangeIndices={selectedVolumeRangeIndices}
                    onToggleVolumeRange={toggleVolumeRange}
                    isDarkMode={isDarkMode}
                    onReset={clearAllFilters}
                  />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                  {/* Sticky Search Header */}
                  <div className={`sticky top-0 z-20 -mx-4 px-4 pt-1 ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
                    {activeTab === 'explorer' && (
                      <div className="relative group mb-6 w-full max-w-full">
                        <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-white/40 group-focus-within:text-red-500' : 'text-gray-400 group-focus-within:text-red-600'}`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className={`block w-full pl-9 pr-24 py-3 rounded-lg border text-xs font-bold placeholder-gray-400 focus:outline-none focus:ring-0 transition-all ${isDarkMode
                            ? 'bg-black/10 border-white/5 focus:border-red-600/50 hover:bg-white/5'
                            : 'bg-white border-gray-100 focus:border-red-100 hover:border-red-50 shadow-sm'
                            }`}
                          placeholder="Search keywords..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        {/* Status Dots Indicators */}
                        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                          {searchQuery.length > 0 ? (
                            <>
                              {(() => {
                                const hasExactMatch = filteredAndSortedData.some(k => k.name.toLowerCase() === searchQuery.trim().toLowerCase());
                                const hasMatch = filteredAndSortedData.length > 0;

                                if (hasExactMatch) {
                                  return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" title="Exact Match" />;
                                } else if (hasMatch) {
                                  return <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Close Match" />;
                                } else {
                                  return <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="No Match" />;
                                }
                              })()}
                            </>
                          ) : (
                            /* Dimmed dots when no query */
                            <div className="flex gap-1.5 opacity-20">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sub-Board Filter Bar */}
                  <div className={`sticky ${activeTab === 'explorer' ? 'top-16' : 'top-0'} z-20 -mx-4 px-4 pb-2 mb-4 ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
                    {(() => {
                      const board = BOARD_DISPLAY_INFO.find(b => b.id === activeTab);
                      if (board?.isParent) {
                        const children = BOARD_DISPLAY_INFO.filter(b => b.parentId === board.id);
                        if (children.length > 0) {
                          return (
                            <div className={`mb-2 p-4 rounded-2xl border flex items-center gap-4 flex-wrap shadow-sm animate-in slide-in-from-top-2 duration-300 ${isDarkMode ? 'bg-[#1a1a20] border-white/5' : 'bg-white border-gray-100'}`}>
                              <div className="flex items-center gap-2 mr-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sub-Categories Barrier</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {children.map(child => {
                                  const isSelected = selectedSubBoardIds.includes(child.id);
                                  return (
                                    <button
                                      key={child.id}
                                      onClick={() => toggleSubBoard(child.id)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all transform active:scale-95 border ${isSelected
                                        ? 'bg-red-600 border-red-700 text-white shadow-[0_4px_12px_rgba(220,38,38,0.2)]'
                                        : isDarkMode ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white' : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-white/50 hover:text-gray-900'
                                        }`}
                                    >
                                      <span className="mr-1.5">{child.icon}</span>
                                      {child.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>

                  {paginatedData.length > 0 ? (
                    <>
                      <KeywordTable
                        data={paginatedData}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        onSelect={setSelectedKeyword}
                        savedKeywords={Object.fromEntries(Object.entries(savedKeywords).map(([k, v]) => [k, `${v.pinnedAt}${v.userName ? ` by ${v.userName}` : ''}`]))}
                        pinnedStates={Object.fromEntries(Object.entries(savedKeywords).map(([k, _]) => [k, true]))}
                        onToggleSave={toggleSaveKeyword}
                        isDarkMode={isDarkMode}
                        showPinnedDate={activeTab === 'saved'}
                        searchQuery={searchQuery}
                      />

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 px-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-black disabled:opacity-50 hover:bg-gray-200 transition-colors"
                            >
                              Prev
                            </button>
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (totalPages > 5) {
                                  if (currentPage <= 3) p = i + 1;
                                  else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                                  else p = currentPage - 2 + i;
                                }

                                if (p > 0 && p <= totalPages) {
                                  return (
                                    <button
                                      key={p}
                                      onClick={() => handlePageChange(p)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${currentPage === p
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                      {p}
                                    </button>
                                  );
                                }
                                return null;
                              })}
                            </div>
                            <button
                              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-black disabled:opacity-50 hover:bg-gray-200 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        👻
                      </div>
                      <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>No Keywords Found</h3>
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Try adjusting your filters or search terms</p>
                      <button onClick={clearAllFilters} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all">
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>


      {/* Modals */}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(u) => setUser(u)}
        isDarkMode={isDarkMode}
      />
      <DapModal
        isOpen={isDapOpen}
        onClose={() => setIsDapOpen(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default App;
