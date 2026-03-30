import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserPlus,
  AlertTriangle,
  AlertCircle,
  ClipboardList,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { useNotificationStore, type AppNotification } from "../../store/notificationStore";

function NotificationIcon({ type }: { type: string }) {
  const iconProps = { size: 14 };
  switch (type) {
    case "offboarding_started":
      return <UserPlus {...iconProps} className="text-teal" />;
    case "task_overdue":
      return <AlertTriangle {...iconProps} className="text-ember" />;
    case "risk_flag":
      return <AlertCircle {...iconProps} className="text-ember" />;
    case "task_assigned":
      return <ClipboardList {...iconProps} className="text-navy" />;
    case "knowledge_review":
      return <BookOpen {...iconProps} className="text-blue-600" />;
    case "exit_interview_submitted":
      return <MessageSquare {...iconProps} className="text-teal" />;
    default:
      return <Bell {...iconProps} className="text-mist" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: AppNotification) => {
    markRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-mist hover:text-navy transition-colors rounded-md hover:bg-navy/5"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-medium text-white bg-ember rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-lg shadow-card border border-navy/10 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy/10">
            <h3 className="text-sm font-semibold text-navy">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-teal hover:text-teal-light transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={24} className="mx-auto text-mist mb-2" />
                <p className="text-sm text-mist">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={clsx(
                    "w-full text-left px-4 py-3 border-b border-navy/5 hover:bg-navy/[0.02] transition-colors",
                    !notification.read && "bg-teal/[0.03]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                        !notification.read ? "bg-teal/10" : "bg-navy/5"
                      )}
                    >
                      <NotificationIcon type={notification.type} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-sm text-navy truncate",
                          !notification.read && "font-medium"
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-mist mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-mist/70 mt-1">
                        {formatDistanceToNow(notification.createdAt, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    {!notification.read && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-teal flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
